export const greet = (name: string = 'World'): string => `Hello, ${name}.`;

if (require.main === module)
    console.log(greet());