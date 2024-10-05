// Initialize counters and load data
let waterCount = 0;
let urinateCount = 0;

// Initialize the database
let db;
const DB_NAME = 'PeeTrackerDB';
const STORE_NAME = 'activities';

// Modified function to display errors
function displayError(error) {
    console.error('Error:', error);
    const errorContainer = document.getElementById('error-container');
    errorContainer.innerHTML = ''; // Clear previous errors
    const errorMessage = document.createElement('p');
    errorMessage.textContent = `Error: ${error.message}`;
    errorContainer.appendChild(errorMessage);
    errorContainer.style.display = 'block'; // Show the error container
}

// New function to hide error container
function hideErrorContainer() {
    const errorContainer = document.getElementById('error-container');
    errorContainer.style.display = 'none';
    errorContainer.innerHTML = ''; // Clear any existing error messages
}

// Open the database
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        
        request.onerror = () => {
            const error = new Error('Failed to open database');
            displayError(error);
            reject(error);
        };
        request.onsuccess = () => {
            hideErrorContainer(); // Hide error container on success
            resolve(request.result);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'timestamp' });
            store.createIndex('activity', 'activity', { unique: false });
        };
    });
}

// Add these new variables at the top of the file
let currentDate = new Date();
let currentDateString = formatDate(currentDate);

// New function to format date
function formatDate(date) {
    const options = { month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

// New function to update displayed date
function updateDisplayedDate() {
    document.getElementById('current-date').textContent = currentDateString;
}

// Modify loadData function
async function loadData() {
    try {
        db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        
        const startOfDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()).getTime();
        const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;
        
        const range = IDBKeyRange.bound(startOfDay, endOfDay);
        
        const waterCountRequest = store.index('activity').count(IDBKeyRange.only('water'), range);
        const urinateCountRequest = store.index('activity').count(IDBKeyRange.only('urinate'), range);
        
        const waterCount = await new Promise((resolve, reject) => {
            waterCountRequest.onsuccess = () => resolve(waterCountRequest.result);
            waterCountRequest.onerror = () => reject(waterCountRequest.error);
        });
        
        const urinateCount = await new Promise((resolve, reject) => {
            urinateCountRequest.onsuccess = () => resolve(urinateCountRequest.result);
            urinateCountRequest.onerror = () => reject(urinateCountRequest.error);
        });
        
        updateCounters(waterCount, urinateCount);
        updateDisplayedDate();
        hideErrorContainer(); // Hide error container on success
    } catch (error) {
        displayError(error);
    }
}

// Modify logActivity function
async function logActivity(activity) {
    try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        
        await new Promise((resolve, reject) => {
            const request = store.add({
                timestamp: Date.now(),
                activity: activity
            });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
        
        // Reload data to update counters
        await loadData();
    } catch (error) {
        displayError(error);
    }
}

// New function to check for date change
function checkDateChange() {
    const newDate = new Date();
    const newDateString = formatDate(newDate);
    
    if (newDateString !== currentDateString) {
        currentDate = newDate;
        currentDateString = newDateString;
        loadData(); // This will reset the counters for the new day
    }
}

// Modify the initialization
function initializeApp() {
    hideErrorContainer(); // Hide error container by default
    loadData();
    updateDisplayedDate();
    // Check for date change every minute
    setInterval(checkDateChange, 60000);
}

// Reset counts for the current day
async function resetCounts() {
    try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        
        // Calculate the start and end of the current day
        const startOfDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()).getTime();
        const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;
        
        // Create a range for the current day
        const range = IDBKeyRange.bound(startOfDay, endOfDay);
        
        // Use a cursor to iterate through and delete records for the current day
        await new Promise((resolve, reject) => {
            const request = store.openCursor(range);
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            request.onerror = () => reject(request.error);
        });
        
        // Update counters to show zero for the current day
        updateCounters(0, 0);
        console.log('Counts reset for the current day');
    } catch (error) {
        displayError(error);
    }
}

// Update counter displays
function updateCounters(waterCount, urinateCount) {
    document.getElementById('water-count').textContent = waterCount;
    document.getElementById('urinate-count').textContent = urinateCount;
}

// Event listeners for buttons
document.getElementById('water-btn').addEventListener('click', () => logActivity('water'));
document.getElementById('urinate-btn').addEventListener('click', () => logActivity('urinate'));
document.getElementById('reset-btn').addEventListener('click', resetCounts);

// Replace loadData() call with initializeApp()
initializeApp();

// Function to clear all caches
async function clearAllCaches() {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
    console.log('All caches cleared');
}

// Register service worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            // Unregister existing service workers
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let registration of registrations) {
                await registration.unregister();
            }
            console.log('Existing service workers unregistered');

            // Clear all caches
            await clearAllCaches();

            // Register new service worker
            const registration = await navigator.serviceWorker.register('./service-worker.js', {
                scope: '/',
                updateViaCache: 'none'
            });
            console.log('Service Worker registered successfully:', registration.scope);

            // Force update
            await registration.update();
            console.log('Service Worker updated');

        } catch (error) {
            console.error('Service Worker registration failed:', error);
            if (error.name === 'TypeError') {
                displayError(new Error('Service Worker file not found. Please check if service-worker.js exists in the root directory.'));
            } else {
                displayError(new Error('Service Worker registration failed: ' + error.message));
            }
        }
    });
}