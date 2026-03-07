import { auth } from "./firebase.js";

import {
createUserWithEmailAndPassword,
signInWithEmailAndPassword,
onAuthStateChanged,
signOut
}
from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

window.register = async function(){

const email=document.getElementById("email").value;
const password=document.getElementById("password").value;

try{
await createUserWithEmailAndPassword(auth,email,password);
alert("Registered Successfully");
}catch(e){
alert(e.message);
}

}

window.login = async function(){

const email=document.getElementById("email").value;
const password=document.getElementById("password").value;

try{
await signInWithEmailAndPassword(auth,email,password);
alert("Login Successful");
}catch(e){
alert(e.message);
}

}

window.logout=function(){
signOut(auth)
}

onAuthStateChanged(auth,(user)=>{

if(user){
document.getElementById("status").innerText="Logged in as " + user.email
}else{
document.getElementById("status").innerText="Not logged in"
}

})
