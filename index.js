import 'dotenv/config'
import OpenAI from "openai";
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

import express from "express"
import cors from "cors"
import bcrypt from "bcrypt"

const app = express()
const PORT = process.env.PORT || 3000

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Middleware
app.use(cors())
app.use(express.json())

let productsCache = [];

async function loadProducts() {
  const { data } = await supabase.from('products').select('*');
  productsCache = data;
}

// Load initially
await loadProducts();

setInterval(loadProducts, 10 * 60 * 1000);
async function aloeVeraBot(userMessage){
    const products = productsCache;

    if(!products || products.length === 0)
    {
        console.log("No products found");
        res.error("No products found");
    }
    const response = await client.chat.completions.create({
        model:"gpt-5-mini",
        messages:[
            {role:"system", content:`You are an Aloe Vera Forever expert. Understant what the user's main health problem is, translate it to english if required. 
                Recommend maximum 5 products from the database that fit the required need of the user and format it like this
                 - Product Name – One-line description – [Buy here](link). Use only the links from the database. If prompted with unrelated problems, respond politely that 
                 you can only provide informations about the Aloe Vera Products and help users get the best product for their needs. Also, write the whole answer in the language you were asked in.`},
            {
                role:"user", content:`User asked ${userMessage}. Here are all the Aloe Vera products ${JSON.stringify(products)}.`
            }     

        ]
    })
   //console.log(products);
    return response.choices[0].message.content;
}



app.post('/signup', async (req, res) => {
    const { email, password, username } = req.body;

    if (!email || !password || !username) {
        return res.status(400).json({ error: 'Email, username and password are required' });
    }
    console.log("Raw body:", req.body)
     //const hashedPassword = await bcrypt.hash(password, 10);

    const { data, signUpError } = await supabase.auth.signUp({
        email,
        password
    });

    if (signUpError) {
        return res.status(500).json({ error: signUpError.message });
    }

    const user = data.user;
    console.log(user.id);
    const {data:profileData, error:insertError} = await supabase
    .from('profiles')
    .insert({
        userid:user.id,
        username:username,
        email:email,
        tier:"base"

    })
    if (insertError) {
      return res.status(400).json({ error: insertError.message })
    }



     return res.status(201).json({
      message: "User signed up successfully",
      user: { id: user.id, email: user.email, username, tier:"base" }
    })
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    const user  = data.user;

    const {data:getData, error: getError} = await supabase
    .from('profiles')
    .select()

    if (getError) {
        return res.status(500).json({ error: getError.message });
    }
    console.log(getData);
    res.status(200).json({ 
        message: "Logged in successfully",
        user: {
            id: user.id,
            email: user.email,
            username: getData[0].username,
            tier: getData[0].tier
        }
    });
});

app.post('/chat/guestmode',async (req,res)=>{
    const question = req.body.question;

    aloeVeraBot(question).then(response => {
        console.log(response);
        res.status(200).json({ message: response });
    }).catch(error => {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while processing your request.' });
    });
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})


