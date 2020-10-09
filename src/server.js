const express = require('express');
const app = express();
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');

//config
app.set('PORT', process.env.PORT || 3000 );

app.use(cors())
   .use(express.json())
   .use(express.urlencoded({extended:true}))
   .use(morgan('dev'))
   .use(express.static(path.join(__dirname, './storage')))


//API'S REST
const rest = require('./rest/index');
app.use(rest);

//PORT
app.listen(app.get( 'PORT' ), () => {
    console.log(`listen on port ${app.get( 'PORT' )}`);
})
