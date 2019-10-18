require('dotenv').config();
const axios = require('axios');
const chalk = require('chalk');
const moment = require('moment');
const ora = require('ora');
const { WOFUPASSWORD: password, WOFUEMAIL: email} = process.env;

const firstDay = moment().startOf('month').format('YYYY-MM-DD');
const lastDay = moment().endOf('month').format('YYYY-MM-DD');
let currentSpinner;
async function run() {
    try {
        currentSpinner = ora(`Logging in to woffu as ${chalk.cyan(email)}...`).start();
        let loginRes = await axios.post('https://app.woffu.com/token', `grant_type=password&username=${email}&password=${password}`, {
            withCredentials: true
        });
        currentSpinner.succeed(chalk.greenBright('Logged in to woffu!'));
        currentSpinner =  ora(`Loading profile...`).start();
        const token = loginRes.data.access_token;
        const headers = { 'authorization' : `Bearer ${token}` };
        let userQuery = await axios.get('https://app.woffu.com/api/users', {
            headers
        });
        const { UserId: userId, FullName: name, CompanyName: company, TrueCompanyId: companyID, Birthday: birthday} = userQuery.data;
        // Idk why I added this as it just makes the code a little bit more complex. But hey! Birthdays should be celebrated! The data is there
        const birthdayString = moment().isSame(birthday, 'day') ? chalk.magenta('Happy birthday!') : '';
        currentSpinner.succeed(`Welcome ${chalk.blue(name)} - ${chalk.red(company)} ${birthdayString}`);
        currentSpinner =  ora(`Loading calendar...`).start();
        // This isn't really needed. I only get the calendar here because I want to count how many days are confirmed the second time I get the calendar
        let firstCalendar = await axios.get(`https://app.woffu.com/api/companies/${companyID}/diaries`, {
            headers,
            params: {
                fromDate: firstDay,
                toDate: lastDay,
                userId,
            }
        });
        const {Diaries: initialDays} = firstCalendar.data;
        let initialConfirmed = 0;
        let initialRemaining = 0;
        initialDays.forEach(day => {
            if (day.Accepted) {
                initialConfirmed++;
            } else {
                initialRemaining++;
            }
        });
        currentSpinner.succeed((`${chalk.blue(initialDays.length)} days this month. ${chalk.greenBright(initialConfirmed)} already confirmed - ${chalk.red(initialRemaining)} remaining`));
        currentSpinner =  ora(chalk.blueBright('Confirming days...')).start();
        // Returns an empty response
        await axios.put(`https://app.woffu.com/api/users/${userId}/diaries/confirm?fromDate=${firstDay}&toDate=${lastDay}`,
            { "UserId": userId },
        { headers });
        currentSpinner.succeed(chalk.greenBright('Days confirmed!'));
        currentSpinner =  ora('Loading calendar').start();
        let finalCalendar = await axios.get(`https://app.woffu.com/api/companies/${companyID}/diaries`, {
            headers,
            params: {
                fromDate: firstDay,
                toDate: lastDay,
                userId,
            }
        });
        const {Diaries: finalDays} = finalCalendar.data;
        let finalConfirmed = 0;
        let finalRemaining = 0;
        finalDays.forEach(day => {
            if (day.Accepted) {
                finalConfirmed++;
            } else {
                finalRemaining++;
            }
        });
        currentSpinner.succeed(`${chalk.greenBright(finalConfirmed)} final days confirmed in total, ${chalk.blueBright(finalConfirmed - initialConfirmed)} this session. ${chalk.red(finalRemaining)} days remaining this month`);


    } catch (error) {
        currentSpinner.fail(`Error ${error.response.status}: ${error.response.statusText}`);
        console.error(error.response.data);
    }

}
console.time('Done');
run().then(() => {
    console.timeEnd('Done');
});
