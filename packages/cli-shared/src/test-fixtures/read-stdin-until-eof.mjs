const watchdog = setTimeout(() => {
  process.stderr.write('stdin remained open')
  process.exit(99)
}, 1000)

process.stdin.once('end', () => {
  clearTimeout(watchdog)
  process.stdout.write('out')
  process.stderr.write('err')
  process.exitCode = 7
})
process.stdin.resume()
