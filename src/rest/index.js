const { Router } = require('express');
const router = Router();
const path = require('path');
const fs = require('fs');

const url = require('./../uri');

// multer
const multer = require('multer');
let fileDate;

const storagePicture = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, './../storage/pictures') )
    },
    filename: (req, file, cb) => {
        const fileType = file.mimetype.split('/')[1]
        fileDate = new Date()
        cb(null, fileDate.getTime() + '.' + fileType)
    }
});

const uploadPicture = multer({storage: storagePicture})

const storageUser = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, './../storage/user_photo') )
    },
    filename: (req, file, cb) => {
        const fileType = file.mimetype.split('/')[1]
        fileDate = new Date()
        cb(null, fileDate.getTime() + '.' + fileType)
    }
})

const uploadUser = multer({storage: storageUser})

// modelos
const ResponseMessage = require('./../models/response.model');
const { Account } = require('./../models/user.model');

//firebase
const firebase = require('firebase');
const firebaseConfig = require('./../FIrebaseDB/index')

firebase.initializeApp(firebaseConfig)

const auth = firebase.auth()
const db = firebase.firestore()

//firebase admin
const admin = require('firebase-admin');
const fireCredenciales = require('./../FIrebaseDB/credenciales.json');
admin.initializeApp({
    credential: admin.credential.cert(fireCredenciales),
})
const authAdmin = admin.auth();

//Cloudinary

const cloudinary = require('cloudinary').v2;
const cloudCredenciales = require('./../cloudinary/index');

cloudinary.config(cloudCredenciales);



// MIDDLEWARES

// middleware para validacion de email y contraseña
const userValidator = (req,res,next) => {

    const { email, password } = req.body

    if ( !email || email.length < 6 || !email.includes('@') ){

        const errorMsg = new ResponseMessage(400,'invalid-email',false)
        res.status(400).json(errorMsg)

    } else if ( !password || password.length < 8 ){

        const errorMsg = new ResponseMessage(400,'invalid-password',false)
        res.status(400).json(errorMsg)

    }

    next()

}




//middleware para validacion del username
const usernameValidator = (req,res,next) => {

    const { username } = req.body

    if ( !username || username.length < 4 ){

        const errorMsg = new ResponseMessage(400,'invalid-username',false)
        res.status(400).json(errorMsg)

    }

    next()

}




//middleware para verificar token
const verifytoken = async (req, res, next) => {

    let token;

    // verificar existencia del token en los headers
    if (req.get('Authorization')) {
        token = req.get('Authorization').split(' ')[1];
    }
    else {
        res.status(400).json(new ResponseMessage(400, 'el token no existe', false))
    }

    // enviar token a firebase y resibir datos del usuario
    await authAdmin.verifyIdToken(token)
          .then( async (response) => {
            req.user = response;

            //  extraer foto de usuario del documento
            await db.collection('users').doc(req.user.uid).get()
            .then(user => {
                if (!user.exists) { return }
                else {
                    data = user.data();
                    req.user.picture = data.photoURL;
                    next()
                };
            })
            .catch(err => res.status(400).json(new ResponseMessage( 400, 'bad_request', false, err )))
          })
          .catch(err => res.status(400).json(new ResponseMessage(400, err.code, false)))

}




// APIS REST



// api para registrar usuario
router.post('/api/signup', usernameValidator, userValidator, async (req, res) => {

    const { email, password, username } = req.body

    // crear nuevo usuario
    const info = await authAdmin.createUser(new Account( email, password, username ))
                       .catch(err => res.status(400).json(new ResponseMessage(400, err.code, false)))

    //guardar datos en firestore
    const user = {
        email,
        displayname: username,
        uid: info.uid,
        photoURL: info.photoURL
    }

    await db.collection('users').doc(info.uid).set(user)
          .catch(err => res.status(400).json(new ResponseMessage(400, err.code, false)))

    //inicar sesión
    await auth.signInWithEmailAndPassword( email, password )
          .then(response => res.json( new ResponseMessage( 200, 'ok', true, response )))
          .catch(err => res.status(400).json(new ResponseMessage(400, err.code, false)))

});




// api para inicar sesión
router.post('/api/signin', userValidator, async (req, res) => {

    const { email, password } = req.body

    await auth.signInWithEmailAndPassword( email, password )
          .then(response => res.json( new ResponseMessage( 200, 'ok', true, response )))
          .catch(err => res.status(400).json(new ResponseMessage(400, err.code, false)))

});




// api para para verificar el token
router.post('/api/verifytoken', verifytoken, (req,res) => {

    res.json( new ResponseMessage( 200, 'ok', true, req.user ))

})




// api para subir imagenes
router.post('/api/uploadfile', verifytoken, uploadPicture.single('file'), async (req, res) => {

    // verificar que existe un file en el body de la peticion
    if ( !req.file ) res.status(400).json(new ResponseMessage( 400, 'bad_request', false ))
    else {

    // data del usuario que subio la imagen
    const { name, uid, picture } = req.user

    const user = {
        displayname: name,
        photoURL: picture,
        uid: uid
    }

    // guardar imagen en cloudinary
    // const pictureURL =  url + `/pictures/${fileDate.getTime()}.${req.file.mimetype.split('/')[1]}`;
    
    const result = await cloudinary.uploader.upload(req.file.path);

    // newPicture es el documento de referencia a la nueva imagen que se guardara en firestore

    const newPicture = {
        url: result.url,
        id: result.public_id,
        user: user,
        date: fileDate,
        likeds: {}  
    }

    // guardar newPicture en firestore
    await db.collection('pictures').doc(result.public_id).set(newPicture)
    .then(data => res.json(new ResponseMessage(200, 'ok', true)))
    .catch(err => res.status(400).json(err))
    }    

})




// api para cambiar foto de perfil
router.patch('/api/updatefile', verifytoken, uploadUser.single('file'), async (req,res) => {

    // verificar que existe un file en el body de la peticion
    if ( !req.file ) { res.status(400).json(new ResponseMessage( 400, 'img_not_found', false )) }
    else {

        // id y foto antigua del usuario que actualizó su foto
        const { uid, picture } = req.user

        // subir foto a cloudinary
        const result = await cloudinary.uploader.upload(req.file.path);


        //ubicacion de la nueva foto el el servidor
        //const pictureURL = url + `/user_photo/${fileDate.getTime()}.${req.file.mimetype.split('/')[1]}`;


        //cambiar photoURL en firebase Auth
        await authAdmin.updateUser(uid, {
            photoURL: result.url
        })
        .catch(error => {
            res.status(400).json(new ResponseMessage(400, 'bad_request', false, error
        ))})

        // si la foto antigua no es default, esta se eliminará
        if (!picture.includes('default')) {
            const del = await cloudinary.uploader.destroy(picture.split('/')[picture.split('/').length -1])
        }

        // cambiar url de la propiedad "photoURL" del usuario en firestore
        const userRef = db.collection('users').doc(uid)

        await userRef.update({
            photoURL: result.url
        })
        .catch(error => res.status(400).json(new ResponseMessage(400, 'bad_request', false, error)))


        // cambiar photoURL de usuario en todas sus imagenes
        const imagesRef = db.collection('pictures')
        const imagesColl = imagesRef.where('user.uid', '==', uid)
        const batch = db.batch()

        await imagesColl.get()
        .then( async (collection) => {

            if (collection.empty) {
                console.log('no se encontro ningun resultado')
                return
            }

            collection.forEach((doc) => {
                const docData = doc.data();
                const docRef = imagesRef.doc(docData.id);
                docData.user.photoURL = result.url;
                batch.update(docRef,docData);
            })

            await batch.commit()
            .then(response => res.json( new ResponseMessage( 200, 'ok', true, response )))
            .catch(error => {
                console.log('error en el batch')
                res.status(400).json(error)
            })

        })
        .catch(error => {
            res.status(400).json(error)
        })

    }

})




// api para dar like a una foto
router.patch('/api/liked', verifytoken, async (req,res) => {

    // verifica si se incluyo el id de la foto en el body de la peticion
    if (!req.body.pictureId) res.status(400).json(new ResponseMessage( 400, 'bad_request', false ))
    else {

        const { pictureId } = req.body

        // id del usuario que dio like
        const { uid } = req.user

        // añadir usuario al objeto 'likeds' para indicar que ha dado like
        const pictureRef = db.collection('pictures').doc(pictureId)
        const update = {};
        update[`likeds.${uid}`] = true

        await pictureRef.update(update)
        .then(data => res.json(new ResponseMessage(200, 'ok', true)))
        .catch(error => res.status(400).json(new ResponseMessage(400, 'bad_request', false, error)))

    }
    

})




// api para quitar like
router.patch('/api/disliked', verifytoken, async (req,res) => {

    // verifica si se incluyo el id de la foto en el body de la peticion
    if (!req.body.pictureId) res.status(400).json(new ResponseMessage( 400, 'bad_request', false ))
    else {

        const { pictureId } = req.body

        // id del usuario que dio like
        const { uid } = req.user

        // añadir usuario al objeto 'likeds' para indicar que ha dado like
        const pictureRef = db.collection('pictures').doc(pictureId)

        let pictureDoc;

        await pictureRef.get()
        .then(doc => {
            pictureDoc = doc.data()
        })
        .catch(error => res.status(400).json(new ResponseMessage(400, 'bad_request', false, error)))

        delete pictureDoc.likeds[uid]

        await pictureRef.update(Object.assign({}, pictureDoc))
        .then(data => res.json(new ResponseMessage(200, 'ok', true)))
        .catch(error => res.status(400).json(new ResponseMessage(400, 'bad_request', false, error)))

    }
    

})



module.exports = router