const url = require('./../uri');

const models = {
    Account: class Account{

        constructor(email, password, displayName){
            this.email = email;
            this.password = password;
            this.displayName = displayName;
            this.photoURL = `${url}/user_photo/default.png`;
        }

    },
    User: class User{
        constructor(email, displayname, uid, photoURL){
            this.email = email;
            this.displayname = displayname;
            this.uid = uid;
            this.photoURL = photoURL;
        }
    }
}

module.exports = models