const express = require("express");
const app = express();
const port = 3000;
const morgan = require("morgan");
const bodyparser = require("body-parser");
const mongoose = require("mongoose");
const { Schema } = mongoose;
const uri = "mongodb://127.0.0.1:27017/mydb";
const core = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const verifyToken = require("./verifyToken");

mongoose
  .connect(uri)
  .then((connect) => {
    if (!connect) {
      console.log("Canot connect to MongoDB");
    } else {
      console.log("Connect to MomgoDB succesfully");
    }
  })
  .catch((err) => console.log(err.message));

const AllergySchema = new Schema(
  {
    ptname: String,
    ptlastname: String,
    hn: String,
    allergies: [
      {
        id: String,
        drugDetail: String,
        allergySymptom: String,
        allergyType: String,
      },
    ],
    statusflag: String,
    status: String,
    createdby: String,
    confirmby: String,
    modifyby: String,
  },
  { collection: "patientallergy", timestamps: true }
);

const USerSchema = new Schema(
  {
    username: String,
    password: String,
    fname: String,
    lname: String,
    role: String,
    statusflag: String,
  },
  { collection: "users", timestamps: true }
);

const Allergy = mongoose.model("patientallergy", AllergySchema);
const User = mongoose.model("User", USerSchema);
app.use(bodyparser.json());

app.use(morgan("short"));

app.use(core());

//const currentDate = new Date();
app.get("/allergy", (req, res) => {
    const currentDate = new Date();
    const startOfToday = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate()
    ); // Set time to the start of today
    const endOfToday = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate() + 1
    ); // Set time to the end of today
  
    Allergy.find({
      $and: [
        { statusflag: "A" },
        { createdAt: { $gte: startOfToday, $lt: endOfToday } },
      ],
    })
      .then((allergydata) => {
        if (!allergydata) {
          res.send("Not Found Allergy data");
        } else {
          res.send(allergydata);
        }
      })
      .catch((err) => console.log(err.message));
  }
);

  

app.get("/allergy/:date", (req, res) => {
  let inputDate = new Date(req.params.date);

  // Adjust input date to 00:00:00 UTC time
  inputDate.setUTCHours(0, 0, 0, 0);

  // Calculate the previous day's 17:00:00 UTC
  let previousDayStart = new Date(inputDate);
  previousDayStart.setUTCDate(inputDate.getUTCDate() - 1);
  previousDayStart.setUTCHours(17, 0, 0, 0);

  // Calculate the current day's 16:59:00 UTC
  let currentDateEnd = new Date(inputDate);
  currentDateEnd.setUTCHours(16, 59, 0, 0);

  console.log(previousDayStart, currentDateEnd);

  Allergy.find({
    $and: [
      {
        statusflag: "A",
      },
      {
        createdAt: {
          $gte: previousDayStart,
          $lt: currentDateEnd,
        },
      },
    ],
  })
    .then((allergydata) => {
      if (!allergydata) {
        res.send("Not Found Allergy data");
      } else {
        res.send(allergydata);
      }
    })
    .catch((err) => console.log(err.message));
});

app.post("/allergy", (req, res) => {
  let newAllergy = new Allergy(req.body);

  newAllergy
    .save()
    .then((allergydata) =>
      res.send("Insert allergy data successfully" + allergydata)
    )
    .catch((err) => console.log(err.message));
});

app.patch("/allergy/:id", (req, res) => {
  let id = req.params.id;

  Allergy.findOne({ $and: [{ _id: id }, { statusflag: "A" }] })
    .then((allergy) => {
      if (!allergy) {
        return res.send("Not Found the Allergy record");
      } else {
        Allergy.findByIdAndUpdate({ _id: id }, { statusflag: "D" })
          .then(() => res.send("Delete record successfully"))
          .catch((err) => console.log(err.message));
      }
    })
    .catch((err) => console.log(err.message));
});

app.patch("/confirmallergy/:id", (req, res) => {
  let id = req.params.id;
  let { confirmby } = req.body;
  Allergy.findByIdAndUpdate(
    { _id: id },
    { status: "confirm", confirmby: confirmby }
  )
    .then(() => res.send("Confirm Allergy Successfully"))
    .catch((err) => console.log(err.message));
});

app.get("/modify/:id", (req, res) => {
  let id = req.params.id;
  Allergy.findOne({ _id: id })
    .then((data) => res.send(data))
    .catch((err) => console.log(err.message));
});

app.patch("/modify/:id", (req, res) => {
  let id = req.params.id;
  let newData = req.body;
  Allergy.findByIdAndUpdate({ _id: id }, newData)
    .then(() => res.send("Update record successfully"))
    .catch((err) => console.log(err.message));
});

app.post("/register", (req, res) => {
  let { username, password, fname, lname, role } = req.body;

  bcrypt.hash(password, 10, function (err, hashedPassword) {
    if (err) {
      return res.status(500).send("Error hashing password");
    }

    let newUser = new User({
      username: username,
      password: hashedPassword,
      fname: fname,
      lname: lname,
      role: role,
      statusflag: "A",
    });

    User.findOne({ username: username, statusflag: "A" })
      .then((user) => {
        if (!user) {
          newUser
            .save()
            .then(() => res.send("Registered user successfully"))
            .catch((err) =>
              res.status(500).send("Error saving user: " + err.message)
            );
        } else {
          res.send("Username is already exist, please use another username");
        }
      })
      .catch((err) =>
        res.status(500).send("Error finding user: " + err.message)
      );
  });
});

const secretKey = "DrugallergySecretkey";

app.post("/login", (req, res) => {
  let { username, password } = req.body;

  User.findOne({ username: username, statusflag: "A" })
    .then((user) => {
      if (!user) {
        res.send("Username or Password incorrect");
      } else {
        bcrypt.compare(password, user.password, (err, result) => {
          if (err) {
            res.status(500).send("Error comparing passwords");
          } else if (result) {
            let { _id, username, fname, lname, role } = user;
            const Token = jwt.sign({ userId: _id }, secretKey, {
              expiresIn: "1d",
            });
            res.send({
              username: username,
              fname: fname,
              lname: lname,
              role: role,
              Token: Token,
            });
          } else {
            res.send("Username or Password incorrect");
          }
        });
      }
    })
    .catch((err) => console.log(err.message));
});

app.listen(port, () => console.log("Server is running on port", port));
