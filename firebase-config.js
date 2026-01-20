// Web app's Firebase configuration (Compat SDK)
const firebaseConfig = {
    apiKey: "AIzaSyDhgpbLOVXdQ5Q6UvkYYMPi66RFdZ4ogLc",
    authDomain: "dielife-d5a74.firebaseapp.com",
    projectId: "dielife-d5a74",
    storageBucket: "dielife-d5a74.firebasestorage.app",
    messagingSenderId: "654557385964",
    appId: "1:654557385964:web:22f4debf14df0ae26e81c9",
    measurementId: "G-XV7KW6K4QF"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const analytics = firebase.analytics();
