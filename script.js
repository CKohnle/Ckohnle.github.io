document.addEventListener('DOMContentLoaded', function() {
    const duck = document.createElement('img');
    duck.id = 'duck';
    duck.src = 'duck.png'; // Ensure this path is correct or use a URL
    duck.alt = 'Duck';
    document.body.appendChild(duck);

    const moveDuckAway = (event) => {
        const duckRect = duck.getBoundingClientRect();
        const cursorX = event.clientX;
        const cursorY = event.clientY;
        const buffer = 50; // Distance the duck will move away
        const edgeBuffer = 50; // Minimum distance from the edges

        if (cursorX > duckRect.left - buffer && cursorX < duckRect.right + buffer &&
            cursorY > duckRect.top - buffer && cursorY < duckRect.bottom + buffer) {

            let newLeft = duckRect.left + (duckRect.left - cursorX);
            let newTop = duckRect.top + (duckRect.top - cursorY);

            // Ensure the duck stays within the viewport with an edge buffer
            if (newLeft < edgeBuffer) newLeft = edgeBuffer;
            if (newTop < edgeBuffer) newTop = edgeBuffer;
            if (newLeft + duckRect.width > window.innerWidth - edgeBuffer) newLeft = window.innerWidth - duckRect.width - edgeBuffer;
            if (newTop + duckRect.height > window.innerHeight - edgeBuffer) newTop = window.innerHeight - duckRect.height - edgeBuffer;

            duck.style.left = newLeft + 'px';
            duck.style.top = newTop + 'px';
        }
    };

    document.addEventListener('mousemove', moveDuckAway);
});
