import express from "express";
import mysql, {Connection} from "mysql2/promise"
import {RowDataPacket} from "mysql2";

async function getBasePriceByType(connection: Connection, type) {
  return (await connection.query(
    'SELECT cost FROM `base_price` ' +
    'WHERE `type` = ? ',
    [type]))[0][0];
}

async function getHolidays(connection: Connection) {
  return (await connection.query(
    'SELECT * FROM `holidays`'
  ))[0] as mysql.RowDataPacket[];
}

function isDateHoliday(holidays: any[], date) {
  let isHoliday;
  for (let row of holidays) {
    let holiday = row.holiday
    if (date) {
      let d = new Date(date as string)
      if (d.getFullYear() === holiday.getFullYear()
        && d.getMonth() === holiday.getMonth()
        && d.getDate() === holiday.getDate()) {

        isHoliday = true
      }
    }

  }
  return isHoliday;
}

async function createApp() {
  const app = express()

  let connectionOptions = {host: 'localhost', user: 'root', database: 'lift_pass', password: 'mysql'}
  const connection = await mysql.createConnection(connectionOptions)

  app.put('/prices', async (req, res) => {
    const liftPassCost = req.query.cost
    const liftPassType = req.query.type
    const [rows, fields] = await connection.query(
      'INSERT INTO `base_price` (type, cost) VALUES (?, ?) ' +
      'ON DUPLICATE KEY UPDATE cost = ?',
      [liftPassType, liftPassCost, liftPassCost]);

    res.json()
  })
  app.get('/prices', async (req, res) => {
    const type = req.query.type;
    const age = req.query.age;
    const date = req.query.date;

    const result = await getBasePriceByType(connection, type)

    let cost = {cost: 0};
    if (age as any < 6) {
      cost = {cost: 0}
    } else {
      if (type !== 'night') {
        const holidays = await getHolidays(connection);

        let isHoliday = isDateHoliday(holidays, date);

        let reduction = 0
        if (!isHoliday && new Date(date as string).getDay() === 1) {
          reduction = 35
        }

        // TODO apply reduction for others
        if (age as any < 15) {
          cost = {cost: Math.ceil(result.cost * .7)}
        } else {
          if (age === undefined) {
            let cost2 = result.cost * (1 - reduction / 100)
            cost = {cost: Math.ceil(cost2)}
          } else {
            if (age as any > 64) {
              let cost2 = result.cost * .75 * (1 - reduction / 100)
              cost = {cost: Math.ceil(cost2)}
            } else {
              let cost2 = result.cost * (1 - reduction / 100)
              cost = {cost: Math.ceil(cost2)}
            }
          }
        }
      } else {
        if (age as any >= 6) {
          if (age as any > 64) {
            cost = {cost: Math.ceil(result.cost * .4)}
          } else {
            cost = result
          }
        } else {
          cost = {cost: 0}
        }
      }
    }
    res.json(cost);
  })
  return {app, connection}
}

export {createApp}
