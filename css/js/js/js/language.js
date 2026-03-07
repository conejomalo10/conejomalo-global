const translations={

en:{
title:"Comunidad Global de Fans de Conejo Malo",
subtitle:"Bad Bunny Global",
community:"Fan Community",
loginBtn:"Member Login / Register",
aboutTitle:"About Community",
aboutText:"Global fan community celebrating the music and culture of Bad Bunny.",
memberTitle:"Membership Access"
},

es:{
title:"Comunidad Global de Fans de Conejo Malo",
subtitle:"Bad Bunny Global",
community:"Comunidad de Fans",
loginBtn:"Acceso / Registro de Miembros",
aboutTitle:"Sobre la Comunidad",
aboutText:"Comunidad global creada para celebrar la música y cultura de Bad Bunny.",
memberTitle:"Acceso de Membresía"
}

}

window.setLanguage=function(lang){

document.querySelectorAll("[data-lang]").forEach(el=>{

const key=el.getAttribute("data-lang")

if(translations[lang] && translations[lang][key]){
el.innerText=translations[lang][key]
}

})

}

const userLang=navigator.language.startsWith("es")?"es":"en"

setLanguage(userLang)
