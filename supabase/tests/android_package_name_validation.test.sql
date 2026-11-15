begin;

select plan(4);

select ok(
  'com.example.app' ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$',
  'accepts a standard dotted Android application ID'
);

select ok(
  'com.example.app2' ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$',
  'accepts numeric characters after the first character of a segment'
);

select ok(
  not ('com..example' ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  'rejects empty package-name segments'
);

select ok(
  not ('com.example.' ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  'rejects a trailing separator'
);

select * from finish();

rollback;
