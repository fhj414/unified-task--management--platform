<script setup lang="ts">
const previewTasks = [
  {
    title: 'Review quarterly access requests',
    owner: 'Operations',
    due: 'Oct 18',
    priority: 'High',
  },
  {
    title: 'Prepare the team planning brief',
    owner: 'Strategy',
    due: 'Oct 22',
    priority: 'Medium',
  },
  {
    title: 'Confirm workspace onboarding steps',
    owner: 'People',
    due: 'Oct 25',
    priority: 'Low',
  },
] as const;
</script>

<template>
  <section id="tasks" class="todo-panel" aria-labelledby="tasks-heading">
    <div class="section-heading">
      <div>
        <p class="eyebrow">Workspace</p>
        <h2 id="tasks-heading">Team tasks</h2>
      </div>
      <span class="preview-badge">Preview content</span>
    </div>

    <p class="preview-note">
      These sample tasks preview the upcoming workspace experience. Task data is not connected yet.
    </p>

    <ul class="task-list" aria-label="Sample task preview">
      <li v-for="task in previewTasks" :key="task.title" class="task-row">
        <div>
          <h3>{{ task.title }}</h3>
          <p>{{ task.owner }} · Due {{ task.due }}</p>
        </div>
        <span class="priority" :data-priority="task.priority.toLowerCase()">
          {{ task.priority }} priority
        </span>
      </li>
    </ul>
  </section>
</template>
