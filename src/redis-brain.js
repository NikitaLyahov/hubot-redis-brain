'use strict'

// Description:
//   Persist hubot's brain to redis
//
// Configuration:
//   REDISTOGO_URL or REDISCLOUD_URL or BOXEN_REDIS_URL or REDIS_URL.
//     URL format: redis://<host>:<port>[/<brain_prefix>]
//     URL format (UNIX socket): redis://<socketpath>[?<brain_prefix>]
//     If not provided, '<brain_prefix>' will default to 'hubot'.
//   REDIS_NO_CHECK - set this to avoid ready check (for exampel when using Twemproxy)
//
// Commands:
//   None

const Url = require('url')
const Redis = require('redis')

module.exports = function (robot) {
  let client, prefix
  const redisUrlEnv = getRedisEnv()
  const redisUrl = process.env[redisUrlEnv] || 'redis://localhost:6379'

  if (redisUrlEnv) {
    robot.logger.info(`hubot-redis-brain: Discovered redis from ${redisUrlEnv} environment variable`)
  } else {
    robot.logger.info('hubot-redis-brain: Using default redis on localhost:6379')
  }

  if (process.env.REDIS_NO_CHECK) {
    robot.logger.info('Turning off redis ready checks')
  }

  robot.logger.info(`!redisUrl = ${redisUrl}`)
  const info = Url.parse(redisUrl)
  robot.logger.info(`!info.hostname = ${info.hostname}`)
  robot.logger.info(`!info.pathname = ${info.pathname}`)

  if (info.hostname === '') {
    client = Redis.createClient(info.pathname)
    prefix = (info.query ? info.query.toString() : undefined) || 'hubot'
  } else {
    client = (info.auth || process.env.REDIS_NO_CHECK)
              ? Redis.createClient(info.port, info.hostname, {no_ready_check: true})
            : Redis.createClient(info.hostname)
    robot.logger.info(`!info.auth = ${info.auth}`)
    robot.logger.info(`!process.env.REDIS_NO_CHECK = ${process.env.REDIS_NO_CHECK}`)
    robot.logger.info(`!info.port = ${info.port}`)
    prefix = (info.path ? info.path.replace('/', '') : undefined) || 'hubot'
    robot.logger.info(`!prefix = ${prefix}`)
  }

  robot.brain.setAutoSave(false)
  robot.logger.info('!counter = ${1}')

  const getData = () =>
    client.get(`${prefix}:storage`, function (err, reply) {
      if (err) {
        robot.logger.info(`!err = ${err}`)
        robot.logger.info('!counter = ${2}')
        throw err
      } else if (reply) {
        robot.logger.info(`!reply = ${reply}`)
        robot.logger.info(`hubot-redis-brain: Data for ${prefix} brain retrieved from Redis`)
        robot.brain.mergeData(JSON.parse(reply.toString()))
        robot.brain.emit('connected')
        robot.logger.info('!counter = ${3}')
      } else {
        robot.logger.info(`!getDataElse = ${prefix}`)
        robot.logger.info(`hubot-redis-brain: Initializing new data for ${prefix} brain`)
        robot.brain.mergeData({})
        robot.brain.emit('connected')
        robot.logger.info('!counter = ${4}')
      }

      robot.brain.setAutoSave(true)
      robot.logger.info('!counter = ${5}')
    })

  if (info.auth) {
    client.auth(info.auth.split(':')[1], function (err) {
      robot.logger.info('!counter = ${6}')
      if (err) {
        robot.logger.info('!counter = ${7}')
        return robot.logger.error('hubot-redis-brain: Failed to authenticate to Redis')
      }

      robot.logger.info('hubot-redis-brain: Successfully authenticated to Redis')
      getData()
      robot.logger.info('!counter = ${8}')
    })
  }

  client.on('error', function (err) {
    if (/ECONNREFUSED/.test(err.message)) {

    } else {
      robot.logger.error(err.stack)
    }
  })

  client.on('connect', function () {
    robot.logger.info('!counter = ${9}')
    robot.logger.debug('hubot-redis-brain: Successfully connected to Redis')
    if (!info.auth) { getData() }
  })

  robot.brain.on('save', (data) => {
    robot.logger.info('!counter = ${10}')
    if (!data) {
      data = {}
    }
    client.set(`${prefix}:storage`, JSON.stringify(data))
  })

  robot.brain.on('close', () => client.quit())
  robot.logger.info('!counter = ${11}')
}

function getRedisEnv () {
  robot.logger.info('!counter = ${12}')

  if (process.env.REDISTOGO_URL) {
    return 'REDISTOGO_URL'
  }

  if (process.env.REDISCLOUD_URL) {
    return 'REDISCLOUD_URL'
  }

  if (process.env.BOXEN_REDIS_URL) {
    return 'BOXEN_REDIS_URL'
  }

  if (process.env.REDIS_URL) {
    return 'REDIS_URL'
  }
}
