document.addEventListener('DOMContentLoaded', function() {
    const duck = document.createElement('img');
    duck.id = 'duck';
    duck.src = 'https://www.pngall.com/wp-content/uploads/10/Mallard-PNG-Pic.png'; // Ensure this path is correct or use a URL
    duck.alt = 'Duck';
    document.body.appendChild(duck);

    const moveDuckAway = (event) => {
        const duckRect = duck.getBoundingClientRect();
        const cursorX = event.clientX;
        const cursorY = event.clientY;
        const buffer = 50; // Distance the duck will move away

        if (cursorX > duckRect.left - buffer && cursorX < duckRect.right + buffer &&
            cursorY > duckRect.top - buffer && cursorY < duckRect.bottom + buffer) {

            let newLeft = duckRect.left + (duckRect.left - cursorX);
            let newTop = duckRect.top + (duckRect.top - cursorY);

            // Ensure the duck stays within the viewport
            if (newLeft < 0) newLeft = 0;
            if (newTop < 0) newTop = 0;
            if (newLeft + duckRect.width > window.innerWidth) newLeft = window.innerWidth - duckRect.width;
            if (newTop + duckRect.height > window.innerHeight) newTop = window.innerHeight - duckRect.height;

            duck.style.left = newLeft + 'px';
            duck.style.top = newTop + 'px';
        }
    };

    document.addEventListener('mousemove', moveDuckAway);
});
