// class User {
//   id: number = 1;
// }

export default {
  base: {
    port: 8080,
  },
  auth: {
    username: "some user",
    password: "some password",
    enabled: true,
  },
  data: {
    uri: "some uri",
    database: "some db",
    collections: {
      users: {
        type: "User",
        _T: "trackable",
        fields: {
          email: { type: "string", required: true, unique: true },
          password: { type: "string", required: true },
          name: { type: "string", required: true },
          groups: { type: "ref", required: true },
          personas: { type: "ref" },
        },
        references: {
          groups: { ref: "groups", type: "many" },
          personas: { ref: "personas", type: "many" },
        },
      },
    },
  },
};
