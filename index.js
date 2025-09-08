import 'dotenv/config'
import OpenAI from "openai";
import { createClient } from '@supabase/supabase-js'
import cookieParser from 'cookie-parser';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

import express from "express"
import cors from "cors"
import bcrypt from "bcrypt"

const app = express()
const PORT = process.env.PORT || 5000

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Middleware
app.use(cors())
app.use(express.json())
app.use(cookieParser());

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

async function createConversation(userid)
{
    const {data, error} = await supabase
    .from('conversations')
    .insert({
        user_id:userid,
        title: "No title"
    })
    .select();
    if(error) 
    {
        console.log(error);
        return error;
    }
    console.log(data);
    return data[0].id;

}

async function createMessage(conversation_id, role, content)
{
    const {data, error} = await supabase
    .from('messages')
    .insert({
        conversation_id,
        role,
        content
    })
    .select();
    if(error) 
    {
        console.log(error);
        return error;
    }
    console.log(data);
    return data[0].id;

}

app.post('/signup', async (req, res) => {
    const { email, password, username } = req.body;

    if (!email || !password || !username) {
        res.status(400).json({ "message": 'Email, username and password are required' });
    }
    console.log("Raw body:", req.body)
     //const hashedPassword = await bcrypt.hash(password, 10);
    
    const { data:data, error: signUpError } = await supabase.auth.signUp({
        email,
        password
    });

    if (signUpError) {
        console.log(signUpError);
        res.json({"message":signUpError});
        return;
    }
    if(data.user == null){
        console.log("Email already exists");
        res.json({"message":"The email is already used, "});
    }
    
    //console.log(signUpError);
    console.log(data);
    try{
        const user = data.user;
        //console.log(user.id);
        const {data:profileData, error:insertError} = await supabase
        .from('profiles')
        .insert({
            userid:user.id,
            username:username,
            email:email,
            tier:"base"

        })
        if (insertError) {
            res.json({"message":"An error has occured. Please try again."});
        }



        res.json({"message":"success"});
    }catch(e){
        console.log(e);
        res.json({"message":"An error has occured, please try again."});
    }
    
});
app.post('/signup/link', async (req, res) => {
    const { email, password, username, link } = req.body;

    if (!email || !password || !username || !link) {
        res.status(400).json({ "message": 'Email, username and password are required' });
    }
    console.log("Raw body:", req.body)
     //const hashedPassword = await bcrypt.hash(password, 10);
    
    const { data:data, error: signUpError } = await supabase.auth.signUp({
        email,
        password
    });

    if (signUpError) {
        console.log(signUpError);
        res.json({"message":signUpError});
        return;
    }
    if(data.user == null){
        console.log("Email already exists");
        res.json({"message":"The email is already used, "});
    }
    
    //console.log(signUpError);
    console.log(data);
    try{
        const user = data.user;
        //console.log(user.id);
        const {data:profileData, error:insertError} = await supabase
        .from('profiles')
        .insert({
            userid:user.id,
            username:username,
            email:email,
            tier:"base"

        })
        if (insertError) {
            console.log(insertError);
            res.json({"message":"An error has occured. Please try again."});
        }
        const {data:linkData, error:linkDataError} = await supabase
        .from('invitelinks')
        .select()
        .eq("link",link)

        if(linkDataError){
            console.log(linkDataError);
            res.json({"message":"An error has occured. Please try again."});
        }
        console.log(linkData);
        const {data:invitedFriends, error: invitedFriendsError} = await supabase
        .from("profiles")
        .select()
        .eq("userid",linkData[0].user_id)

        if(invitedFriendsError){
            console.log(invitedFriendsError);
            res.json({"message":"An error has occured. Please try again."});
        }
        let nrInvitedFriends = invitedFriends[0].invited_friends;
        nrInvitedFriends++;
        let tier = invitedFriends[0].tier;
        if(invitedFriends>=5 && invitedFriends<10)
            tier = "tier 1";
        else if(invitedFriends>=10 && invitedFriends<15)
            tier = "tier 2";
        else if(invitedFriends>=15)
            tier = "tier 3";
        const {data:updateD, error:updateDError} = await supabase
        .from("profiles")
        .update({
            tier:tier,
            invited_friends:nrInvitedFriends

        })
        .eq("userid",linkData[0].user_id);

        if(updateDError)
        {
            console.log(updateDError);
            res.json({"message":"An error has occured. Please try again."});

        }
        



        res.json({"message":"success"});
    }catch(e){
        console.log(e);
        res.json({"message":"An error has occured, please try again."});
    }
    
});


app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ "message": 'Email and password are required' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        return res.status(500).json({ "message": error.message });
    }
   //const user  = data.user;

    const {data:getData, error: getError} = await supabase
    .from('profiles')
    .select()
    .eq("email", email);

    if (getError) {
        return res.status(500).json({ "message": getError.message });
    }
    const { session, user } = data;

  // Store access_token in HTTP-only cookie
    res.cookie("userid", user.id);

    res.json({"message":"success",
        "user": {
            "userid":user.id,
            "username": getData[0].username,
            "tier": getData[0].tier,
            "email":email
        }
    });
    /*console.log(getData);
    res.status(200).json({ 
        message: "Logged in successfully",
        user: {
            id: user.id,
            email: user.email,
            username: getData[0].username,
            tier: getData[0].tier
        }
    });*/
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

app.post('/chat/usermode/getAllConversations', async (req,res)=>{
    const userid = req.body.userid;

    const {data, error} = await supabase
    .from('conversations')
    .select()
    .eq('user_id', userid);
    console.log(data);
    if (error) {
        console.error(error);
        return res.status(500).json({ error: 'An error occurred while fetching conversations.' });
    }

    res.status(200).json({ conversations: data });
})

app.post('/chat/usermode/startConvo', async (req, res) => {
    const { userid} = req.body;

    try {
        const conversation_id = await createConversation(userid);
        
        res.status(200).json({"message":"success", "conversationid": conversation_id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ "message": 'An error occurred while processing your request.' });
    }
});

app.post('/chat/usermode/getConversation',async(req,res)=>{
    const {conversation_id} = req.body;
    console.log(conversation_id)
    const {data, error}= await supabase
    .from('messages')
    .select()
    .eq('conversation_id', conversation_id);

    if (error) {
        console.error(error);
        return res.status(500).json({ error: 'An error occurred while fetching the conversation.' });
    }
    console.log(data);
    res.status(200).json({ messages: data });
})

app.post('/chat/usermode/sendMessage', async (req, res) => {
    const { conversation_id, question } = req.body;

    try {
        const {data, error}= await supabase
        .from('conversations')
        .select()
        .eq('id', conversation_id);
        if(error) res.send({"message":error});

        if(data[0].title=="No title")
        {
            const { error } = await supabase
            .from('conversations')
            .update({ title: question })
            .eq('id', conversation_id)
            if(error) res.send({"message":error});
        }
           

        await createMessage(conversation_id, "user", question);

        const response = await aloeVeraBot(question);
        await createMessage(conversation_id, "bot", response);
        res.status(200).json({ message: response });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while sending the message.' });
    }
});

app.put('/changeusername', async(req,res)=>{
    const {userid, username} = req.body;

    const {error} = await supabase
    .from('profiles')
    .update({ username })
    .eq('userid', userid);

    if (error) {
        console.error(error);
        return res.status(500).json({ "message": 'An error occurred while updating the username.' });
    }

    res.status(200).json({ "message": 'success' });
})

app.put('/changepassword', async(req,res)=>{

    const {email,oldpassword,newpassword} = req.body;

    const {data, error} = await supabase.auth.signInWithPassword({
        email,
        password: oldpassword
    });

    if (error) {
        console.error(error);
        return res.status(401).json({ "message": 'Invalid credentials.' });
    }

    const { error: updateError } = await supabase.auth.updateUser({
        password: newpassword
    });

    if (updateError) {
        console.error(updateError);
        return res.status(500).json({ "message": 'An error occurred while updating the password.' });
    }

    res.status(200).json({ "message": 'success' });
})

app.delete('/delete/conversation', async (req,res)=>{
   const {conversation_id} = req.body;

   const {error} = await supabase
   .from('conversations')
   .delete()
   .eq('id', conversation_id);

   if (error) {
       console.error(error);
       return res.status(500).json({ "message": 'An error occurred while deleting the conversation.' });
   }

   res.status(200).json({ "message": 'success' });
})

app.delete('/delete/all/conversations', async (req,res)=>{
   const {userid} = req.body;

   const {error} = await supabase
   .from('conversations')
   .delete()
   .eq('user_id', userid);

   if (error) {
       console.error(error);
       return res.status(500).json({ "message": 'An error occurred while deleting all conversations.' });
   }

   res.status(200).json({ "message": 'success' });
})

app.post('/delete-account', async (req, res) => {
  const { user_id } = req.body

  const { error } = await supabase.auth.admin.deleteUser(user_id)

  if (error) return res.status(400).json({ "message": error.message })

    await supabase.from('profiles').delete().eq('userid', user_id)
  res.json({ "message": 'success' })
})

app.post('/createlink',async (req,res)=>{
    const {userid, link} = req.body;
    try{
            const {data:search, error:searchError} = await supabase
            .from('invitelinks')
            .select()
            .eq("user_id",userid);
            if(searchError)
            {
                console.log(searchError)
                res.send({"message":"An error has occured."});
                return;
            }
            const {data:deleteL , error:deleteError} = await supabase
            .from('invitelinks')
            .delete()
            .eq("id",search[0].id)
            if(deleteError)
            {
                console.log(searchError)
                res.send({"message":"An error has occured."});
                return;
            }

            

            const {data, error} = await supabase
            .from('invitelinks')
            .insert({
                user_id:userid,
                link:link
            })
            if(error)
            {
                console.log(error);
                res.send({"message":"An error has intervened, please contact support"});
            }
            else
            {
                res.send({"message":"success"});
            }
    }catch(e)
    {
        console.log(e);
        res.send({"message":"An error has intervened, please contact support"});
    }
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})


