// authGuard.js

function authGuard() {
    const authToken = sessionStorage.getItem('authToken');
    if (!authToken) {
        window.location.href = '/login'; // redirect to login page if not authenticated
    }
}

export default authGuard;
