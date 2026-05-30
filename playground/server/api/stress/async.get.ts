export default defineEventHandler(async (event) => {
  // Ground-truth id taken synchronously from the handler's own event object.
  const tid = (event.context.spyglassRequestId as string | undefined)?.slice(0, 8)
  console.log(`[stress:async tid=${tid}] step 1 sync`)
  await new Promise(resolve => setTimeout(resolve, 25))
  console.log(`[stress:async tid=${tid}] step 2 after setTimeout`)
  await Promise.resolve().then(() => {
    console.log(`[stress:async tid=${tid}] step 3 in promise chain`)
  })
  await Promise.all([
    (async () => {
      await new Promise(resolve => setTimeout(resolve, 5))
      console.log(`[stress:async tid=${tid}] step 4a parallel branch`)
    })(),
    (async () => {
      await new Promise(resolve => setTimeout(resolve, 10))
      console.log(`[stress:async tid=${tid}] step 4b parallel branch`)
    })(),
  ])
  return { ok: true }
})
