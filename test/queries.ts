export const queryTrustFactories = () => `
  {
    trustFactories {
      id
      trustCount
      trusts {
        id
      }
    }
  }
`;

