#!/usr/bin/env node
require('dotenv').config({ path: `${__dirname}/.env`});
const axios = require('axios');
const chalk = require('chalk');
const moment = require('moment');
const ora = require('ora');
const prompts = require('prompts');
const SimpleCrypto = require("simple-crypto-js").default;
const fs = require('fs');
const { machineIdSync } = require('node-machine-id');
const crypto = new SimpleCrypto(machineIdSync());
const notifier = require('node-notifier');
const argv = require('yargs')
    .usage('Usage: $0 [options]')
    .example('$0', 'Run the tool with the previously saved password, if it exists')
    .example('$0 --email john@corp.com --password hunter2', 'Run the command tool with a specific email and password combination')
    .example('$0 --reset', 'Reset saved and password')
    .alias('r', 'reset')
    .nargs('r', 0)
    .describe('r', 'Reset saved username and password')
    .boolean('r')
    .nargs('email', 1)
    .string('email')
    .describe('email', 'Specify email to use')
    .nargs('password', 1)
    .string('password')

    .describe('password', 'Specify password to use')
    //.demandOption(['f'])
    .help('h')
    .alias('h', 'help')
    .implies('email', 'password')
    .conflicts('r', ['email', 'password'])
    .strict(true)
    .epilog('Made with ❤️')
    .argv;

let { WOFUPASSWORD: password, WOFUEMAIL: email } = process.env;

const firstDay = moment().startOf('month').format('YYYY-MM-DD');
const lastDay = moment().endOf('month').format('YYYY-MM-DD');
let spinner = ora();

console.time('Done');
run().then(() => {
    console.timeEnd('Done');
    process.exit();
});

async function run() {
    if (!argv.email && (!email || !password || argv.reset)) {
        const response = await prompts([
                {
                    type: 'text',
                    name: 'email',
                    message: 'What is your woffu email?',
                    validate: val =>
                        /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(val) ? true : 'Email Must be valid'
                },
                {
                    type: 'password',
                    name: 'password',
                    message: 'What is your woffu password',
                    validate: val => !val ? 'Password cannot be blank' : true
                }

            ]);
        if (!response.email || !response.password) {
            console.log(`✖ Canceled`);
            return;
        }
        email = response.email;
        const encryptedPassword = crypto.encrypt(response.password);
        fs.writeFileSync(`${__dirname}/.env`, `WOFUEMAIL="${email}"\nWOFUPASSWORD="${encryptedPassword}"`);
        password = encryptedPassword;
    }
    try {
        spinner.start(`Logging in to woffu as ${chalk.cyan(email)}...`);
        let loginRes = await axios.post('https://app.woffu.com/token', `grant_type=password&username=${argv.email|| email}&password=${argv.password || crypto.decrypt(password)}`, {
            withCredentials: true
        });
        spinner.succeed(chalk.greenBright('Logged in to woffu!'));
        spinner.start(`Loading profile...`);
        const token = loginRes.data.access_token;
        const headers = { 'authorization': `Bearer ${token}` };
        let userQuery = await axios.get('https://app.woffu.com/api/users', {
            headers
        });
        const { UserId: userId, FullName: name, CompanyName: company, TrueCompanyId: companyID, Birthday: birthday } = userQuery.data;
        // Idk why I added this as it just makes the code a little bit more complex. But hey! Birthdays should be celebrated! The data is there
        const birthdayString = moment().isSame(birthday, 'day') ? chalk.magenta('Happy birthday! 🎂 🎈 🎉') : '';
        spinner.succeed(`Welcome ${chalk.blue(name)} - ${chalk.red(company)} ${birthdayString}`);
        spinner.start(`Loading calendar...`);
        // This isn't really needed. I only get the calendar here because I want to count how many days are confirmed the second time I get the calendar
        let firstCalendar = await axios.get(`https://app.woffu.com/api/companies/${companyID}/diaries`, {
            headers,
            params: {
                fromDate: firstDay,
                toDate: lastDay,
                userId,
            }
        });
        const { Diaries: initialDays } = firstCalendar.data;
        let initialConfirmed = 0;
        let initialRemaining = 0;
        initialDays.forEach(day => {
            if (day.Accepted) {
                initialConfirmed++;
            } else {
                initialRemaining++;
            }
        });

        spinner.succeed((`${chalk.blue(initialDays.length)} days this month. ${chalk.greenBright(initialConfirmed)} already confirmed - ${chalk.red(initialRemaining)} remaining`));
        spinner.start(chalk.blueBright('Confirming days...'));
        // Returns an empty response
        await axios.put(`https://app.woffu.com/api/users/${userId}/diaries/confirm?fromDate=${firstDay}&toDate=${lastDay}T23:00:00`,
            { "UserId": userId },
            { headers });
        spinner.succeed(chalk.greenBright('Days confirmed!'));
        spinner.start('Loading calendar...');
        // Get the calendar a second time to see how many days have been confirmed now
        let finalCalendar = await axios.get(`https://app.woffu.com/api/companies/${companyID}/diaries`, {
            headers,
            params: {
                fromDate: firstDay,
                toDate: lastDay,
                userId,
            }
        });
        const { Diaries: finalDays } = finalCalendar.data;
        let finalConfirmed = 0;
        let finalRemaining = 0;
        finalDays.forEach(day => {
            if (day.Accepted) {
                finalConfirmed++;
            } else {
                finalRemaining++;
            }
        });
        spinner.succeed(`${chalk.greenBright(finalConfirmed)} final days confirmed in total, ${chalk.blueBright(finalConfirmed - initialConfirmed)} confirmed this session. ${chalk.red(finalRemaining)} days remaining this month`);

        const successMsg = `${finalConfirmed} total days confirmed in total, ${finalConfirmed - initialConfirmed} confirmed this session. ${finalRemaining} days remaining this month.`;

        notifier.notify({ title: 'Woffu', message: successMsg});

    } catch (error) {
        if (error.response) {
            if (error.response.data.error_description) {
                spinner.fail(`Error ${error.response.status}: ${error.response.statusText}`);
            } else {
                spinner.fail(`Error ${error.response.status}: ${error.response.statusText}`);
                console.error(error.response.data);
            }
        } else {
            console.error(error)
        }

    }

}
