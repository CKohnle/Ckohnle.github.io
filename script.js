document.addEventListener('DOMContentLoaded', function() {
    // Check if the current page is the index page
    if (document.body.classList.contains('index-page')) {
        const duck = document.createElement('img');
        duck.src = 'duck.png'; // Path to your duck image
        duck.alt = 'Duck';
        duck.id = 'duck';
        document.body.appendChild(duck);

        const quackSound = document.getElementById('quack-sound');
        let duckPosX = window.innerWidth / 2 - 25;
        let duckPosY = window.innerHeight - 60;
        duck.style.left = `${duckPosX}px`;
        duck.style.top = `${duckPosY}px`;

        function moveDuck(event) {
            const mouseX = event.clientX;
            const mouseY = event.clientY;

            if (mouseX < duckPosX) {
                duckPosX += 10;
            } else {
                duckPosX -= 10;
            }

            if (mouseY < duckPosY) {
                duckPosY += 10;
            } else {
                duckPosY -= 10;
            }

            duck.style.left = `${duckPosX}px`;
            duck.style.top = `${duckPosY}px`;
        }

        document.addEventListener('mousemove', moveDuck);

        duck.addEventListener('click', function() {
            quackSound.play();
        });
    }

document.addEventListener('DOMContentLoaded', function() {
    // Like button code
    const likeButton = document.getElementById('like-button');
    const likeCount = document.getElementById('like-count');
    const likeCheckmark = document.getElementById('like-checkmark');
    let isLiked = localStorage.getItem('isLiked') === 'true';
    let count = 0; // Initialize count to 0 initially

    // Fetch the initial like count from the server when the page loads
    fetch('https://your-server-url/get-like-count') // Replace with your server URL
        .then(response => response.json())
        .then(data => {
            count = data.likeCount; // Update count with the value from the server
            likeCount.textContent = count; // Update the like count displayed on the page
        });

    if (isLiked) {
        likeCheckmark.style.display = 'inline';
    }

    if (likeButton) {
        likeButton.addEventListener('click', function() {
            if (isLiked) {
                count--;
                likeCheckmark.style.display = 'none';
            } else {
                count++;
                likeCheckmark.style.display = 'inline';
            }
            isLiked = !isLiked;
            localStorage.setItem('isLiked', isLiked);
            likeCount.textContent = count;

            // Update the like count on the server
            fetch('https://your-server-url/update-like-count', { // Replace with your server URL
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ likeCount: count })
            });
        });
    }
});

