import React, { useState } from 'react';

const DAD_JOKES = [
  "Why don't scientists trust atoms? Because they make up everything!",
  "I'm reading a book about anti-gravity. It's impossible to put down!",
  "Why did the scarecrow win an award? Because he was outstanding in his field!",
  "I used to hate facial hair, but then it grew on me.",
  "What do you call a fake noodle? An impasta!",
  "I only know 25 letters of the alphabet. I don't know Y.",
  "What did the ocean say to the beach? Nothing, it just waved.",
  "Why do fathers take an extra pair of socks when they go golfing? In case they get a hole in one!",
  "I'm afraid for the calendar. Its days are numbered.",
  "What do you call a bear with no teeth? A gummy bear!",
  "I don't trust stairs. They're always up to something.",
  "What did the janitor say when he jumped out of the closet? Supplies!",
  "Why couldn't the bicycle stand up by itself? It was two tired!",
  "I told my wife she was drawing her eyebrows too high. She seemed surprised.",
  "I got a reversible jacket for Christmas. I can't wait to see how it turns out.",
  "What do you call cheese that isn't yours? Nacho cheese!",
  "Why did the math book look so sad? Because it had too many problems.",
  "I wouldn't buy anything with velcro. It's a total rip-off.",
  "What's the best thing about Switzerland? I don't know, but the flag is a big plus.",
  "Why do cows have hooves instead of feet? Because they lactose!",
  "Did you hear about the restaurant on the moon? Great food, no atmosphere.",
  "I used to play piano by ear, but now I use my hands.",
  "How does a penguin build its house? Igloos it together!",
  "Why don't eggs tell jokes? They'd crack each other up!",
  "What do you call a dog that does magic tricks? A Labracadabrador!",
  "I just got a job at a bakery. I'm making dough!",
  "Want to hear a joke about paper? Never mind, it's tearable.",
  "What did the grape say when it was stepped on? Nothing, it just let out a little wine.",
  "Why did the golfer bring two pairs of pants? In case he got a hole in one!",
  "I'm on a seafood diet. I see food and I eat it.",
  "What do you call a lazy kangaroo? A pouch potato!",
  "How do you organize a space party? You planet!",
  "Why don't skeletons fight each other? They don't have the guts.",
  "I told a chemistry joke but got no reaction.",
  "What do you get when you cross a snowman with a vampire? Frostbite!",
  "Why was the big cat disqualified from the race? Because it was a cheetah!",
  "I'd tell you a construction joke, but I'm still working on it.",
  "What do you call a fish without eyes? A fsh!",
  "Why did the coffee file a police report? It got mugged!",
  "What do sprinters eat before a race? Nothing, they fast!",
  "Rolling steel all day? That's what I call a riveting career!",
  "Why did the welder go to school? To get a little brighter!",
  "I told the metal it was getting rolled today. It said 'I'm under a lot of pressure.'",
  "What's a plate roller's favorite music? Heavy metal!",
  "Why was the steel beam so confident? It had a lot of support!",
];

let lastJokeIndex = -1;

function WalterJoke() {
  const [showJoke, setShowJoke] = useState(false);
  const [joke, setJoke] = useState('');

  const tellJoke = () => {
    let idx;
    do {
      idx = Math.floor(Math.random() * DAD_JOKES.length);
    } while (idx === lastJokeIndex && DAD_JOKES.length > 1);
    lastJokeIndex = idx;
    setJoke(DAD_JOKES[idx]);
    setShowJoke(true);
  };

  return (
    <>
      {/* Walter Icon */}
      <div
        onClick={tellJoke}
        title="Click for a dad joke from Walter!"
        style={{
          position: 'fixed',
          top: 12,
          right: 12,
          width: 48,
          height: 48,
          borderRadius: '50%',
          overflow: 'hidden',
          cursor: 'pointer',
          zIndex: 1100,
          border: '3px solid #f5c842',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.15)';
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(245,200,66,0.5)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
        }}
      >
        <img
          src="/walter.png"
          alt="Walter"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>

      {/* Speech Bubble */}
      {showJoke && (
        <div style={{
          position: 'fixed',
          top: 12,
          right: 72,
          zIndex: 1100,
          maxWidth: 340,
          animation: 'walterFadeIn 0.3s ease-out',
        }}>
          {/* Bubble arrow pointing right */}
          <div style={{
            position: 'absolute',
            right: -8,
            top: 16,
            width: 0,
            height: 0,
            borderTop: '8px solid transparent',
            borderBottom: '8px solid transparent',
            borderLeft: '8px solid #fff',
            filter: 'drop-shadow(2px 0 1px rgba(0,0,0,0.1))',
          }} />
          {/* Bubble body */}
          <div style={{
            background: 'white',
            borderRadius: 16,
            padding: '14px 18px',
            paddingRight: 36,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            border: '2px solid #f5c842',
            position: 'relative',
            fontSize: '0.9rem',
            lineHeight: 1.5,
            color: '#333',
          }}>
            {/* Close button */}
            <button
              onClick={(e) => { e.stopPropagation(); setShowJoke(false); }}
              style={{
                position: 'absolute',
                top: 6,
                right: 8,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                color: '#999',
                padding: '2px 6px',
                borderRadius: 4,
                lineHeight: 1,
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#333'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#999'}
            >
              ✕
            </button>
            <div style={{ fontWeight: 600, color: '#f5a623', fontSize: '0.75rem', marginBottom: 4 }}>
              🐾 Walter says...
            </div>
            {joke}
          </div>
        </div>
      )}

      <style>{`
        @keyframes walterFadeIn {
          from { opacity: 0; transform: translateX(10px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </>
  );
}

export default WalterJoke;
