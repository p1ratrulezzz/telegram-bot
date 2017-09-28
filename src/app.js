'use strict';

const config = require('../config/config');
const Telegraf = require('telegraf');
const logger = require('winston');

class Application {
  /**
   * @public
   */
  constructor () {
    logger.level = 'debug';
    logger.info('App instance created');

    /**
     * @type {Telegraf}
     */
    this.bot = '';
  }

  /**
   * @protected
   */
  start() {
    let bot = this.bot = new Telegraf(config.Token);

    bot.use(Telegraf.memorySession());

    let messagesCollect = [];

    bot.telegram.sendMessageOriginal = bot.telegram.sendMessage;
    bot.telegram.sendMessage = function(chatId, text, extra) {
      return this.sendMessageOriginal(chatId, text, extra).then((result) => {
        messagesCollect.push(result);
        return result;
      });
    }

    bot.command('start', ({ from, reply }) => {
      console.log('start', from);
      return reply('Welcome!');
    });

    bot.command('gc', ({ from, reply, message }) => {
      messagesCollect.forEach((value, index) => {
        bot.telegram.deleteMessage(message.chat.id, value.message_id);
      });

      return reply('Deleted');
    });

    bot.hears('hi', (ctx) => ctx.reply('Hey there!'));
    bot.on('sticker', (ctx) => ctx.reply('👍'));

    // Handle message update
    bot.on('message', (ctx) =>  {
      messagesCollect.push(ctx.message);
    });



    bot.startPolling()
  }

  stop() {
    this.bot.stop();
  }
}

let app = new Application();
app.start();


/**
 * Debugging on app stop.
 */
process.on('SIGINT', () => {
  app.stop();
  logger.info('= SIGINT received. Saving data and shutting down.');

  process.exit(0);
});