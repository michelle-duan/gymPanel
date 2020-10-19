// import the require module for this sub-router.
const MongoClient = require('mongodb').MongoClient;
require('dotenv').config();

// initialize the database connection criteria.
const url = 'mongodb+srv://' +
    process.env.username + ':' +
    process.env.password + '@testdb.qzr4t.mongodb.net/' +
    process.env.database + '?retryWrites=true&w=majority';
const client = new MongoClient(url, { useNewUrlParser: true });

module.exports = (app, utils) => {

    // this router handle the get request for the front end to get all time slot for a specific trainer.
    app.get("/trainer/:trainerId", (req,res) => {
        const trainerId = req.params.trainerId;
        console.log("Receiver request to get the schedule of trainer " + trainerId);
        void client.connect((err, db) => {
            if (err) throw err;

            // get all time slot for a specific trainer.
            client.db(process.env.database).collection("trainers")
                .findOne({id: parseInt(trainerId)}, (err, result) => {
                if (err) throw err;
                if (!result || result.length === 0) {
                    res.writeHead(404);
                    res.end("Trainer " + trainerId + " is not found!");
                } else {
                    res.json(result.scheduledTime)
                }
            });
        });
    });

    // This router handles the request for a user to make a schedule to a trainer for a specific time slot.
    app.put("/trainer", (req, res) => {
        const appointment = req.body;
        console.log(`Received request for user ${appointment.username} to schedule ${appointment.startTime} 
        - ${appointment.endTime} for trainer ${appointment.trainerId} at day ${appointment.date}`);
        void client.connect((err, db) => {
            if (err) throw err;

            // Get the scheduled times for the current user to check if there is conflict.
            client.db(process.env.database).collection("users").findOne({username: appointment.username})
                .then(result => {
                if (!result) return null;
                const appointmentIntervals = result.scheduledTime[appointment.date];
                appointmentIntervals.push([appointment.startTime, appointment.endTime]);
                if (utils.existOverlap(appointmentIntervals)) {
                    return null;
                } else {

                    // Get the time table for the trainer to check whether there is a time conflict for the trainer.
                    return client.db(process.env.database).collection("trainers")
                        .findOne({id: appointment.trainerId});
                }
            }, err => console.log(err)).then(result => {
                if (!result || result.length === 0) return null;
                const intervals = result.scheduledTime[appointment.date];
                intervals.push([appointment.startTime, appointment.endTime]);
                if (utils.existOverlap(intervals)) {
                    return null;
                } else {

                    // push the current time slot to the user's scheduled time.
                    const identifier = "scheduledTime." + appointment.date;
                    return client.db(process.env.database).collection("users").updateOne(
                        {username: appointment.username},
                        {$push: {[identifier]: [appointment.startTime, appointment.endTime]}}
                        );
                }
            }, err => console.log(err)).then(result => {
                if (!result || result.modifiedCount === 0) {
                    return null;
                } else {

                    // push the current appointment to the user's scheduled appointment list.
                    return client.db(process.env.database).collection("users").updateOne(
                        {username: appointment.username},
                        {$push: {scheduledAppointments: appointment}}
                    );
                }
            }, err => console.log(err)).then(result => {
                if (!result || result.modifiedCount === 0) {
                    return null;
                } else {

                    // push the current appointment to the trainer scheduled appointment list.
                    const identifier = "scheduledTime." + appointment.date;
                    return client.db(process.env.database).collection("trainers").updateOne(
                        {id: appointment.trainerId},
                        {$push: {[identifier]: [appointment.startTime, appointment.endTime]}}
                    );
                }
            }, err => console.log(err)).then(result => {
                if (!result || result.modifiedCount === 0) {
                    console.log(appointment.username + " fail schedule appointment with " + appointment.trainerId);
                    res.sendStatus(409)
                } else {
                    console.log(appointment.username + " successfully schedule appointment with " + appointment.trainerId);
                    res.sendStatus(200)
                }
            }, err => console.log(err));
        });
    });

    // todo: when the schedule features is implemented, add the router to handle delete request.
};