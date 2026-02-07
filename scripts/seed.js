const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://admin:password123@127.0.0.1:5432/webapp_db',
});

async function seed() {
  try {
    console.log('Refreshing database schema with score and result tracking...');

    await pool.query(`DROP TABLE IF EXISTS user_assessments CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS users CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS courses CASCADE;`);

    await pool.query(`
            CREATE TABLE users (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(6) UNIQUE NOT NULL,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL
            );
        `);

    await pool.query(`
            CREATE TABLE courses (
                id SERIAL PRIMARY KEY,
                course_id VARCHAR(6) UNIQUE NOT NULL,
                slug VARCHAR(255) UNIQUE NOT NULL,
                title VARCHAR(255) NOT NULL
            );
        `);

    await pool.query(`
            CREATE TABLE user_assessments (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(6) NOT NULL,
                course_id VARCHAR(6) NOT NULL,
                status VARCHAR(50) DEFAULT 'not_started',
                attempts_taken INTEGER DEFAULT 0,
                score INTEGER,
                result VARCHAR(50),
                proctoring_logs JSONB,
                start_time TIMESTAMP,
                end_time TIMESTAMP,
                UNIQUE(user_id, course_id)
            );
        `);

    // Seed Users
    const users = [
      { id: '888888', username: 'admin', password: 'password123' },
      { id: '999999', username: 'user1', password: 'password123' }
    ];

    for (const user of users) {
      await pool.query(`
                INSERT INTO users (user_id, username, password)
                VALUES ($1, $2, $3);
            `, [user.id, user.username, user.password]);
    }

    // Seed Courses
    const courses = [
      { id: '111111', slug: 'ubuntu-linux', title: 'Ubuntu Linux Administrator' },
      { id: '222222', slug: 'cybersecurity-101', title: 'Cybersecurity 101' },
      { id: '333333', slug: 'python-101', title: 'Python 101' }
    ];

    for (const course of courses) {
      await pool.query(`
                INSERT INTO courses (course_id, slug, title)
                VALUES ($1, $2, $3);
            `, [course.id, course.slug, course.title]);
    }

    console.log('Database seeded successfully!');
  } catch (err) {
    console.error('Error seeding database:', err);
  } finally {
    await pool.end();
  }
}

seed();
