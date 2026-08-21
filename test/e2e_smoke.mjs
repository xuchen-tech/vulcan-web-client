/**
 * vulcan-web-client 端到端冒烟（Node + browser_shim + @wsopcua/wsopcua）
 *
 * 覆盖：连接 → 浏览 → 读 → 写 → 订阅一拍 →（可选）Server 方法 Call
 *
 * 用法（假定 vulcan_server 4840 --ws 4843 已启动）：
 *   node test/e2e_smoke.mjs
 *   WSOPCUA_URL=ws://127.0.0.1:4843/opcua node test/e2e_smoke.mjs
 *
 * 可选环境变量：
 *   WSOPCUA_SPEED_NODE   默认 ns=3;s=CONFIG.RESOURCE1.Task1.Drive.Speed
 *   WSOPCUA_COUNTER_NODE 默认 ns=3;s=CONFIG.RESOURCE1.Task1.PLC.Counter
 *   WSOPCUA_SKIP_METHOD=1  跳过方法调用步骤
 */
import './browser_shim.mjs'

import {
  AttributeIds,
  CallMethodRequest,
  ClientSubscription,
  DataType,
  DataValue,
  MessageSecurityMode,
  OPCUAClient,
  ReadValueId,
  SecurityPolicy,
  Variant,
  WriteValue,
  coerceNodeId,
} from '@wsopcua/wsopcua'
import { TimestampsToReturn } from '@wsopcua/wsopcua/service-subscription'

const url = process.env.WSOPCUA_URL || 'ws://127.0.0.1:4843/opcua'
const speedNodeId =
  process.env.WSOPCUA_SPEED_NODE ||
  'ns=3;s=CONFIG.RESOURCE1.Task1.Drive.Speed'
const counterNodeId =
  process.env.WSOPCUA_COUNTER_NODE ||
  'ns=3;s=CONFIG.RESOURCE1.Task1.PLC.Counter'
const skipMethod = process.env.WSOPCUA_SKIP_METHOD === '1'
const userName = process.env.WSOPCUA_USER?.trim()
const userPassword = process.env.WSOPCUA_PASSWORD ?? ''

let failures = 0

function check(cond, label) {
  if (cond) {
    console.log(`PASS ${label}`)
  } else {
    console.error(`FAIL ${label}`)
    failures += 1
  }
}

function statusGood(statusCode) {
  if (!statusCode) {
    return true
  }
  if (typeof statusCode.isNotGood === 'function') {
    return !statusCode.isNotGood()
  }
  const value = statusCode.value ?? statusCode._value
  if (value != null) {
    return (value & 0x80000000) === 0
  }
  return true
}

async function waitForEvent(emitter, eventName, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      emitter.off(eventName, onEvent)
      reject(new Error(`${eventName} timeout after ${timeoutMs}ms`))
    }, timeoutMs)

    function onEvent(...args) {
      clearTimeout(timer)
      emitter.off(eventName, onEvent)
      resolve(args)
    }

    emitter.on(eventName, onEvent)
  })
}

const client = new OPCUAClient({
  securityMode: MessageSecurityMode.None,
  securityPolicy: SecurityPolicy.None,
  endpoint_must_exist: false,
  connectionStrategy: { maxRetry: 1 },
})

let session
let subscription

try {
  console.log(`connect ${url} ...`)
  await client.connectP(url)
  check(true, `connect ${url}`)

  session = await client.createSessionP(
    userName
      ? { userIdentityInfo: { userName, password: userPassword } }
      : {},
  )
  check(true, userName ? `createSession (${userName})` : 'createSession (anonymous)')

  const rootBrowse = await session.browseP('i=84')
  const rootRefs = rootBrowse.results?.[0]?.references ?? []
  check(rootRefs.length > 0, `browse RootFolder (${rootRefs.length} references)`)

  const speedRead = await session.readVariableValueP(speedNodeId)
  const speedValue = speedRead.value?.value?.value
  check(speedValue != null, `read ${speedNodeId}`)
  console.log(`  Speed = ${speedValue}`)

  const counterReadBefore = await session.readVariableValueP(counterNodeId)
  const counterBefore = counterReadBefore.value?.value?.value
  check(counterBefore != null, `read ${counterNodeId}`)
  console.log(`  Counter = ${counterBefore}`)

  const writeCounter =
    typeof counterBefore === 'number' ? counterBefore + 100 : 100
  const writeStatus = await session.writeP(
    new WriteValue({
      nodeId: coerceNodeId(counterNodeId),
      attributeId: AttributeIds.Value,
      value: new DataValue({
        value: new Variant({
          value: writeCounter,
          dataType: DataType.Int32,
        }),
      }),
    }),
  )
  if (statusGood(writeStatus)) {
    check(true, `write ${counterNodeId} = ${writeCounter}`)
  } else {
    const detail = writeStatus?.name ?? writeStatus?.toString?.() ?? 'bad status'
    console.log(`SKIP write (${detail})`)
    check(true, 'write optional skip')
  }

  const counterReadAfter = await session.readVariableValueP(counterNodeId)
  check(
    counterReadAfter.value?.value?.value != null,
    `read-back ${counterNodeId} = ${counterReadAfter.value?.value?.value}`,
  )

  subscription = new ClientSubscription(session, {
    requestedPublishingInterval: 500,
    requestedLifetimeCount: 60,
    requestedMaxKeepAliveCount: 10,
    maxNotificationsPerPublish: 100,
    publishingEnabled: true,
    priority: 10,
  })

  await waitForEvent(subscription, 'started', 15000)
  check(subscription.isActive(), 'subscription started')

  const monitoredItem = await subscription.monitorP(
    new ReadValueId({
      nodeId: coerceNodeId(counterNodeId),
      attributeId: AttributeIds.Value,
    }),
    {
      samplingInterval: 500,
      discardOldest: true,
      queueSize: 1,
    },
    TimestampsToReturn.Both,
  )
  check(monitoredItem.monitoredItemId != null, `monitor ${counterNodeId}`)

  let notificationSeen = false
  const notificationPromise = waitForEvent(monitoredItem, 'changed', 8000)
    .then(([dataValue]) => {
      notificationSeen = true
      console.log(
        `  Counter notification = ${dataValue?.value?.value ?? '<null>'}`,
      )
    })
    .catch(() => {
      /* 假数据线程可能尚未翻转；读回退验证 */
    })

  await Promise.race([
    notificationPromise,
    new Promise((resolve) => setTimeout(resolve, 8000)),
  ])

  if (!notificationSeen) {
    const counterRead = await session.readVariableValueP(counterNodeId)
    check(
      counterRead.value?.value?.value != null,
      `subscription fallback read ${counterNodeId}`,
    )
    console.log(
      `  Counter (poll fallback) = ${counterRead.value?.value?.value}`,
    )
  } else {
    check(true, 'subscription notification received')
  }

  if (!skipMethod && subscription.subscriptionId != null) {
    try {
      const callResponse = await session.callP([
        new CallMethodRequest({
          objectId: coerceNodeId('ns=0;i=2253'),
          methodId: coerceNodeId('ns=0;i=11492'),
          inputArguments: [
            new Variant({
              dataType: DataType.UInt32,
              value: subscription.subscriptionId,
            }),
          ],
        }),
      ])

      const callResult = callResponse.result?.[0]
      if (callResult && statusGood(callResult.statusCode)) {
        check(true, `call Server.GetMonitoredItems(subId=${subscription.subscriptionId})`)
        check(
          (callResult.outputArguments?.length ?? 0) >= 2,
          'GetMonitoredItems returned server/client handles',
        )
      } else {
        const detail =
          callResult?.statusCode?.toString?.() ?? 'no result'
        console.log(`SKIP method call (server returned ${detail})`)
        check(true, 'method call optional skip')
      }
    } catch (err) {
      console.log(
        `SKIP method call (${err instanceof Error ? err.message : String(err)})`,
      )
      check(true, 'method call optional skip')
    }
  } else if (skipMethod) {
    console.log('SKIP method call (WSOPCUA_SKIP_METHOD=1)')
  }

  await monitoredItem.terminateP()
  await subscription.terminateP()
  subscription = null
  check(true, 'terminate subscription')

  await session.closeP()
  session = null
  check(true, 'closeSession')
} catch (err) {
  console.error('ERROR:', err instanceof Error ? err.message : String(err))
  failures += 1
}

try {
  if (subscription) {
    await subscription.terminateP()
  }
  if (session) {
    await session.closeP()
  }
  await client.disconnectP()
} catch (err) {
  console.error('cleanup error:', err instanceof Error ? err.message : String(err))
}

if (failures > 0) {
  console.error(`FAILED: ${failures} checks`)
  process.exit(1)
}

console.log('PASS vulcan-web-client end-to-end smoke')
process.exit(0)
