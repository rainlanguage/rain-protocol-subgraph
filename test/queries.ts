export const QUERY = `
    {
    trustFactories{
      id
      trustCount
      trusts {
        id
        creator
        block
        timestamp
        factory
        notices {
          id
        }
        trustParticipants {
          id
        }
        distributionProgress {
          id
        }
        contracts {
          id
        }
      }
    }
  }
  
`;