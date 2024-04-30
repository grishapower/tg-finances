import TelegramBot from "node-telegram-bot-api";
import { JWT } from "google-auth-library";

import _chunk from "lodash.chunk";
import { google } from "googleapis";
import dotenv from "dotenv";
import dayjs from "dayjs";

dotenv.config();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

const jwtClient = new JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

jwtClient.authorize(function (err) {
  if (err) {
    console.log("123", err);
    return;
  } else {
    console.log("Successfully connected!");
  }
});

const spreadsheetId = process.env.GOOGLE_SHEET_ID;
const sheets = google.sheets("v4", jwtClient);

let appendRow = {
  date: null,
  amount: 0,
  category: null,
  person: null,
  desc: "",
};

// Обработчик команды /add

const ids = [77714067, 62378975];
bot.onText(/\/add/, (msg) => {
  console.log("msg", msg);
  if (!ids.includes(msg.from.id)) {
    return bot.sendMessage(msg.chat.id, "Тебе нельзя");
  }

  //записали дату
  appendRow.date = dayjs().format("DD.MM/HH:mm");

  bot.sendMessage(msg.chat.id, "Введите сумму:");
  bot.once("message", async (msg) => {
    //записали время
    appendRow.amount = parseFloat(msg.text);

    const { data } = await sheets.spreadsheets.values.get({
      range: "Лист1!A2:A9",
      spreadsheetId: spreadsheetId,
      auth: jwtClient,
    });
    const categories = _chunk(
      data.values
        .flat()
        .map((i) => ({ text: i, callback_data: `category_${i}` })),
      2
    );

    console.log("categories", categories);

    bot.sendMessage(msg.chat.id, "Выберите категорию:", {
      reply_markup: {
        inline_keyboard: categories,
      },
    });
  });
});

bot.on("callback_query", (msg, qwe) => {
  const splittedData = msg.data.split("_");
  const callbackType = splittedData[0];

  if (callbackType === "category") {
    //записали категорию
    appendRow.category = splittedData[1];
    bot.sendMessage(msg.message.chat.id, "Кто потратил ?", {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Гриша 👨", callback_data: "person_Гриша" },
            { text: "Лиза 👩", callback_data: "person_Лиза" },
            { text: "Общее 👨👩", callback_data: "person_Вместе" },
          ],
        ],
      },
    });
  }

  if (callbackType === "person") {
    //записали кто потратил
    appendRow.person = splittedData[1];

    bot.sendMessage(msg.message.chat.id, "Описание: ");
    bot.once("message", async (msg) => {
      //записали кто описание
      appendRow.desc = msg.text;

      sheets.spreadsheets.values.append(
        {
          auth: jwtClient,
          spreadsheetId: spreadsheetId,
          range: "Лист1",
          valueInputOption: "RAW",
          resource: {
            values: [
              [
                appendRow.date,
                appendRow.amount,
                appendRow.category,
                appendRow.person,
                appendRow.desc,
              ],
            ],
          },
        },
        (err, response) => {
          if (err) {
            console.error("Ошибка при добавлении данных", err);
            bot.sendMessage(
              msg.chat.id,
              "Произошла ошибка при добавлении /add"
            );
          } else {
            bot.sendMessage(
              msg.chat.id,
              "Трата успешно добавлена <a>/add</a>",
              {
                parse_mode: "HTML",
              }
            );
          }
        }
      );
    });
  }
});

bot.on("polling_error", console.log);
