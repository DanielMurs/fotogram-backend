
// modelo para generar las respuestas a las peticiones
module.exports = class ResponseMessage {

    constructor(code, message, ok, body){
        this.ok = ok
        this.code = code
        this.message = message
        this.body = body
    }

}

/*
tipos de errores en las peticiones:

    codigo 400:

        INVALID_EMAIL:     el email es igual a "undefined", tiene menos de 7 caracteres o no contiene un "@"
        INVALID_PASSWORD:  la contraseña es igual a "undefined" o tiene menos de 8 caracteres/ la contraseña es incorrecta
        EMAIL_EXISTS:      el email que se intenta registrar ya existe
        EMAIL_NOT_FOUND:   el email al que se intenta acceder no existe
        USER_DISABLED:     usuario inhabilitado

    codigo 500:

        INTERNAL_SERVER_ERROR:   eror al realizar la peticion a firebase

*/