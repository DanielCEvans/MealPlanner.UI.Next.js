'use client'

import styles from "./page.module.css";
import { useState } from "react";


export default function Home() {
  const [username, setUsername] = useState('')
  
  const registerClick = () => {
    console.log(`register user ${username}`);
  }
  
  const authenticateClick = () => {
    console.log(`authenticate user ${username}`);
  }
  
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(event.target.value)
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <form>
          <input type="text" placeholder="username" value={username} onChange={handleInputChange}></input>
          <input type="button" value={"Register"} onClick={registerClick}></input>
          <input type="button" value={"Authenticate"} onClick={authenticateClick}></input>
        </form>
      </main>
    </div>
  );
}
