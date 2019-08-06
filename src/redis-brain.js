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

  robot.logger.info(`hubot-redis-brain: !redisUrl = ${redisUrl}`)
  const info = Url.parse(redisUrl)
  robot.logger.info(`hubot-redis-brain: !info.hostname = ${info.hostname}`)
  robot.logger.info(`hubot-redis-brain: !info.pathname = ${info.pathname}`)
  robot.logger.info(`hubot-redis-brain: !info.auth = ${info.auth}`)

  if (info.hostname === '') {
    client = Redis.createClient(info.pathname)
    prefix = (info.query ? info.query.toString() : undefined) || 'hubot'
  } else {
    client = (info.auth || process.env.REDIS_NO_CHECK)
              ? Redis.createClient(info.port, info.hostname, {no_ready_check: true})
            : Redis.createClient(info.hostname)
    robot.logger.info(`hubot-redis-brain: !info.auth = ${info.auth}`)
    robot.logger.info(`hubot-redis-brain: !process.env.REDIS_NO_CHECK = ${process.env.REDIS_NO_CHECK}`)
    robot.logger.info(`hubot-redis-brain: !info.port = ${info.port}`)
    prefix = (info.path ? info.path.replace('/', '') : undefined) || 'hubot'
    robot.logger.info(`hubot-redis-brain: !prefix = ${prefix}`)
  }

  robot.logger.info(`hubot-redis-brain: !client = ${client}`)

  robot.brain.setAutoSave(false)

  info.auth = true

  const getData = () =>
    client.get(`${prefix}:storage`, function (err, reply) {
      robot.logger.info('hubot-redis-brain: !counter 1')
      if (err) {
        robot.logger.info('hubot-redis-brain: !counter 2')
        throw err
      } else if (reply) {
        robot.logger.info(`hubot-redis-brain: Data for ${prefix} brain retrieved from Redis`)
        robot.brain.mergeData(JSON.parse(reply.toString()))
        robot.brain.emit('connected')
        robot.logger.info('hubot-redis-brain: !counter 3')
      } else {
        robot.logger.info(`hubot-redis-brain: Initializing new data for ${prefix} brain`)
        robot.brain.mergeData({})
        robot.brain.emit('connected')
        robot.logger.info('hubot-redis-brain: !counter 4')
      }

      robot.brain.setAutoSave(true)
      robot.logger.info('hubot-redis-brain: !counter 5')
    })

  if (info.auth) {
    robot.logger.info('hubot-redis-brain: !counter 6')
    client.auth(info.auth.split(':')[1], function (err) {
      if (err) {
        robot.logger.info('hubot-redis-brain: !counter 7')
        return robot.logger.error('hubot-redis-brain: Failed to authenticate to Redis')
      }

      robot.logger.info('hubot-redis-brain: Successfully authenticated to Redis')
      getData()
      robot.logger.info('hubot-redis-brain: !counter 8')
    })
  }

  client.on('error', function (err) {
    if (/ECONNREFUSED/.test(err.message)) {

    } else {
      robot.logger.error(err.stack)
    }
  })

  getData()

  client.on('connect', function () {
    robot.logger.info('hubot-redis-brain: !counter 9')
    robot.logger.debug('hubot-redis-brain: Successfully connected to Redis')
    if (!info.auth) { getData() }
  })

  robot.brain.on('save', (data) => {
    if (!data) {
      data = {}
    }
    robot.logger.info('hubot-redis-brain: !counter 10')
    client.set(`${prefix}:storage`, JSON.stringify(data))
  })

  robot.brain.on('close', () => client.quit())
}

function getRedisEnv () {
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
