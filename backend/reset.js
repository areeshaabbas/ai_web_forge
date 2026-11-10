import { connect } from './db.js';
import { seed } from './seed.js';

if (!process.argv.includes('--confirm-demo-reset')) {
  console.error('To reset the configured demo database, run npm run db:reset -- --confirm-demo-reset.');
  process.exit(1);
}
const store=await connect();
try {
  await seed(store,{reset:true});
  console.log('Fictional MongoDB demo dataset reset.');
} finally {
  await store.client.close();
}
