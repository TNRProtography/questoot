
import React from 'react';

export const GAME_SETTINGS = {
  questionCount: 10,
  questionTime: 15, // seconds
  introTime: 3, // seconds
  resultTime: 3, // seconds
  leaderboardTime: 5, // seconds
};

export const COLORS = {
  red: 'bg-red-600',
  blue: 'bg-blue-600',
  green: 'bg-green-600',
  yellow: 'bg-yellow-500',
  purple: 'bg-purple-700',
  background: 'bg-gray-800'
};

export const SHAPE_COLORS = [
  'bg-red-500 hover:bg-red-600',
  'bg-blue-500 hover:bg-blue-600',
  'bg-yellow-500 hover:bg-yellow-600',
  'bg-green-500 hover:bg-green-600',
];

export const SHAPES: JSX.Element[] = [
    <svg key="triangle" viewBox="0 0 100 100" className="w-8 h-8"><polygon points="50 15, 100 85, 0 85" /></svg>,
    <svg key="diamond" viewBox="0 0 100 100" className="w-8 h-8"><polygon points="50 0, 100 50, 50 100, 0 50" /></svg>,
    <svg key="circle" viewBox="0 0 100 100" className="w-8 h-8"><circle cx="50" cy="50" r="45" /></svg>,
    <svg key="square" viewBox="0 0 100 100" className="w-8 h-8"><rect width="80" height="80" x="10" y="10" /></svg>,
];