import prompts from 'prompts';

const response = await prompts({
  type: 'select',
  name: 'value',
  message: 'Pick a color',
  choices: [
    { title: 'Red', description: 'This option has a description', value: '#ff0000' },
    { title: 'Green', value: '#00ff00', disabled: true },
    { title: 'Blue', value: '#0000ff' }
  ],
  initial: 1
});

console.log(response.value);
