<template>
  <h3>Vue example</h3>
  <nav>
    <ul>
      <li>
        <RouterLink to="/">Home</RouterLink>
      </li>
      <li>
        <RouterLink to="/client">Counter (client)</RouterLink>
      </li>
      <li>
        <RouterLink to="/server">Counter (server)</RouterLink>
      </li>
    </ul>
  </nav>
  <main>
    <RouterView />
  </main>
</template>
