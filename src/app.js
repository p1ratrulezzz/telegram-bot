'use strict';

const config = require('../config/config');
const Telegraf = require('telegraf');
const logger = require('winston');
const JsonDB = require('node-json-db');
const tgresolver = require("tg-resolve");

// Apply quote method.
RegExp.quote = require("regexp-quote")

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

    this.tgresolver = '';
  }

  /**
   * @protected
   */
  start() {
    let self = this;
    this.tgresolver = new tgresolver.Tgresolve(config.Token);
    let bot = this.bot = new Telegraf(config.Token);

    // bot.use(Telegraf.memorySession());

    let messagesCollect = [];
    let mentionDBFile = new JsonDB("data/mention_aliases.json", true, true);
    let aliasesDB = {
      aliases: {},
      index: {}
    };

    try {
      mentionDBFile.push('/updated', new Date().toISOString());
      aliasesDB.aliases = mentionDBFile.getData('/aliases');
    }
    catch (error) {
      switch (error.id) {
        case 5:
          // Data doesn't exist yet.
          break;
        default:
          this.shutdown();
          break;
      }
    }

    // Create index array for faster search.
    for (let id in aliasesDB.aliases) {
      let item = aliasesDB.aliases[id];
      if (item.aliases.length !== 0) {
        item.aliases.forEach((value) => {
          aliasesDB.index[value] = item;
        });
      }
    }

    // Collect self messages.
    bot.telegram.sendMessageOriginal = bot.telegram.sendMessage;
    bot.telegram.sendMessage = function(chatId, text, extra) {
      return this.sendMessageOriginal(chatId, text, extra).then((result) => {
        // messagesCollect.push(result);
        return result;
      });
    }

    bot.command('start', ({ from, reply }) => {
      return reply('Hello. And fuck you.');
    });

    // bot.command('gc', ({ from, reply, message }) => {
    //   messagesCollect.forEach((value, index) => {
    //     bot.telegram.deleteMessage(message.chat.id, value.message_id);
    //   });
    //
    //   return reply('Deleted');
    // });

    // bot.command('mention', ({ from, reply, message }) => {
    //   return reply('[' + from.first_name + '](tg://user?id=' + from.id + '), you\'ve been mentioned', {
    //     parse_mode: 'Markdown'
    //   });
    // });

    bot.command('alias', ({ from, reply, message, match, contextState, chat }) => {
      let argText = message.text.substr(message.text.indexOf(' '));
      argText = argText.replace(/\s*/i, '');
      let nicknameReg = new RegExp('\@([^\s]+)', 'ig');
      let nickname = nicknameReg.exec(argText);
      let userId = from.id;
      let pGotUserId = Promise.resolve(userId);
      if (nickname !== null) {
        argText = argText.replace(nicknameReg, '');
        nickname = nickname[1];

        pGotUserId = new Promise((resolve, reject) => {
          // using the 'resolver'
          self.tgresolver.tgresolve('@kamikazechaser', function(error, result) {
            if (error === null) {
              resolve(result.id);
            }
            else {
              resolve(userId);
            }
          });
        });
      }

      return pGotUserId.then((userId) => {
        let names = argText.replace(/\s*,\s*/ig, ',').replace(/,,/ig, ',').split(',');

        aliasesDB.aliases[userId] = aliasesDB.aliases[userId] || {
          id: userId,
          aliases: []
        };

        names.forEach((value) => {
          let aliasClean = value.toLocaleLowerCase();
          if (aliasesDB.index[aliasClean] === undefined) {
            aliasesDB.aliases[userId].aliases.push(aliasClean);
            aliasesDB.index[aliasClean] = aliasesDB.aliases[from.id];
          }
        });

        mentionDBFile.push('/aliases/' + userId, aliasesDB.aliases[userId]);

        return reply('Your alias nicknames were set');
      });
    });

    bot.command('delalias', ({ from, reply, message, match, contextState }) => {
      // let argText = message.text.substr(message.text.indexOf(' '));
      // argText = argText.replace(/\s*/i, '');
      // let names = argText.replace(/\s*,\s*/ig, ',').replace(/,,/ig, ',').split(',');
      //
      // aliasesDB.aliases[from.id] = aliasesDB.aliases[from.id] || {
      //   id: from.id,
      //   aliases: []
      // };

      if (aliasesDB.aliases[from.id] != null) {
        aliasesDB.aliases[from.id].aliases.forEach((value) => {
          if (aliasesDB.index[value] != null) {
            delete aliasesDB.index[value];
          }
        });
      }

      try {
        mentionDBFile.delete('/aliases/' + from.id);
      }
      catch (error) {
        logger.log(error);
      }

      return reply('Your alias nicknames were deleted');
    });

    // Handle message update
    bot.on('message', ({ reply, message, contextState, chat }) =>  {
      // Check if it is not a command.
      if (message.text == null || message.text.substr(0, 1) == '/') {
        return;
      }

      let chatId = chat.id;

      for (let alias in aliasesDB.index) {
        let item = aliasesDB.index[alias];

        let reg = new RegExp('(' + RegExp.quote(alias)  + ') ?[,\.\?\!\)\(]', 'i');
        let result = reg.exec(message.text);
        if (result !== null) {
          let mentionMd = '[' + result[1] +'](tg://user?id=' + item.id +')';
          let modifiedText = message.text.replace(reg, mentionMd);

          return reply(mentionMd + ', you\'ve been mentioned', {
            parse_mode: 'Markdown',
            disable_notification: false
          })
          .catch((error) => {
            logger.log(error);
          });

          // return bot
          // .telegram
          // .editMessageText(chatId, message.id, null, modifiedText)
          // .catch((err) => {
          //   return reply(mentionMd + ', you\'ve been mentioned', {
          //     parse_mode: 'Markdown',
          //     disable_notification: false
          //   });
          // });
        }
      }

    });

    bot.startPolling();
  }

  stop() {
    this.bot.stop();
  }

  shutdown() {
    process.shutdown();
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