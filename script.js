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
    const likeButtons = document.querySelectorAll('.like-button');
    
    likeButtons.forEach(function(button) {
        const likeCount = button.nextElementSibling;
        const likeCheckmark = button.querySelector('.like-checkmark');
        let isLiked = localStorage.getItem(button.id) === 'true';
        let count = parseInt(likeCount.textContent);

        if (isLiked) {
            likeCheckmark.style.display = 'inline';
        }

        button.addEventListener('click', function() {
            if (isLiked) {
                count--;
                likeCheckmark.style.display = 'none';
            } else {
                count++;
                likeCheckmark.style.display = 'inline';
            }
            isLiked = !isLiked;
            localStorage.setItem(button.id, isLiked);
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
    });
});

