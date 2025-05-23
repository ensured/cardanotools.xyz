export const GAME_CONSTANTS = {
  SHOT_COOLDOWN: 150,
  DIFFICULTY_SCORE_INTERVAL: 2000,
  MAX_ROTATION_SPEED: 0.05,
  ROTATION_ACCELERATION: 0.003,
  ROTATION_FRICTION: 0.97,
  POWER_UP_DURATION: 15000,
  POWER_UP_DROP_CHANCE: 1,
  POWER_UP_LIFETIME: 15000,
  POWER_UP_BLINK_START: 3000,
  SHIP_SIZE: 12,
  THRUST_POWER: 0.02,
  FRICTION: 0.988,
  LASER_RANGE: 320,
  LASER_DAMAGE_INTERVAL: 50,
  LASER_DAMAGE_PER_TICK: 0.25,
  ASTEROID_COLLISION_FACTOR: 0.5,
  BULLET_DAMAGE: 1,
  BOSS_SPAWN_INTERVAL: 1,
  MAX_ASTEROIDS: 20,
  BOSS_BULLET_DAMAGE: 1,
  BOSS_BULLET_SPEED: 3,
  BOSS_ATTACK_COOLDOWN: 2000,
  BOSS_HEALTH_MULTIPLIER: 5,
  SHIELD_DAMAGE_BOSS: 0.2,
  SHIELD_DAMAGE_ASTEROID: 0.5,
  SHIELD_VULNERABILITY: 0.1,
} as const
