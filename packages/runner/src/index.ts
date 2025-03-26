import 'dotenv/config'
import { Command } from 'commander'
import { version } from '../package.json'

const program = new Command()

program.name('polka-runner').description('polka.codes service runner').version(version)

program.parse()
