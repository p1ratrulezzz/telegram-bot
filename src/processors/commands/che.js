'use strict';

const COMMAND = 'che';
const VKPublicSearcher = require('../../modules/vk_public_search/main');
const vkapi = require('node-vkapi');

/**
 * Local constants
 * @private
 */
const PUBLIC_INFO = {
  //id: -123, // id has priority
  domain: '21jqofa'
};

/**
 *
 * @param app
 * @param bot
 */
function register({app, bot}) {
  let vk = new vkapi({
    v: '5.68', // @fixme: To config
  });
  bot.command(COMMAND, ({ctx}) => {
    vkapi
    return reply('Hello. And fuck you.');
  });
}

module.exports = {
  enabled: true,
  command: COMMAND,
  description: 'Start command',
  help: 'Are you so stupid to ask?',
  register
}