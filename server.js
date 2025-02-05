const express = require('express');  
const http = require('http');  
const socketIo = require('socket.io');  

const app = express();  
const server = http.createServer(app);  
const io = socketIo(server);  

// Object to hold active users  
const activeUsers = {};  

// Serve static files  
app.use(express.static('public'));  

// Function to emit the number of active users  
const updateActiveUsersCount = () => {  
    io.emit('updateUserCount', Object.keys(activeUsers).length);  
};  

// Listen for connections  
io.on('connection', (socket) => {  
    console.log('A user connected');  
    updateActiveUsersCount(); // Update user count when a user connects  

    // Handle user joining  
    socket.on('join', (username) => {  
        // Create a new user entry  
        activeUsers[socket.id] = { username, pairedWith: null };  
        console.log(`${username} has joined the chat`);  
        pairUsers(socket); // Try to pair after joining  
        updateActiveUsersCount(); // Update user count when a user joins  
    });  

    // Handle receiving a message  
    socket.on('sendMessage', (message) => {  
        const recipientId = activeUsers[socket.id]?.pairedWith;  
        if (recipientId) {  
            io.to(recipientId).emit('receiveMessage', {  
                message,  
                sender: activeUsers[socket.id].username,  
            });  
        }  
    });  

    // Handle user disconnecting  
    socket.on('disconnect', () => {  
        const user = activeUsers[socket.id];  
        if (user) {  
            const username = user.username;  
            delete activeUsers[socket.id];  
            console.log(`${username} has left the chat`);  
            updateActiveUsersCount(); // Update user count when a user disconnects  

            // Notify the paired user if they exist  
            for (const [id, pairedUser] of Object.entries(activeUsers)) {  
                if (pairedUser.pairedWith === socket.id) {  
                    pairedUser.pairedWith = null; // Reset paired status  
                    io.to(id).emit('pairEnded', username); // Notify paired user  
                    break;  
                }  
            }  
        }  
    });  
});  

// Function to pair users  
const pairUsers = (socket) => {  
    const currentUser = activeUsers[socket.id];  

    // Find another random user who is not the current user and not already paired  
    const otherUsers = Object.entries(activeUsers).filter(  
        ([id, user]) => id !== socket.id && user.pairedWith === null  
    );  

    if (otherUsers.length > 0) {  
        const [randomId, pairedUser] = otherUsers[Math.floor(Math.random() * otherUsers.length)];  

        // Pair the two users  
        currentUser.pairedWith = randomId; // Set their paired connection  
        pairedUser.pairedWith = socket.id; // Set pairedWith in the other user  

        // Notify both users about each other  
        socket.emit('privateChat', pairedUser.username);  
        io.to(randomId).emit('privateChat', currentUser.username);  
    } else {  
        socket.emit('waitingForPair', 'Waiting for another user to join...');  
    }  
};  

const PORT = process.env.PORT || 3000;  
server.listen(PORT, () => {  
    console.log(`Server is running on http://localhost:${PORT}`);  
});
