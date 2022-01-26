/* eslint-disable prettier/prettier */
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

export const NOTICE_QUERY = `
  {
    notices{
      sender
      data
      trust{
        id
      }
    }
  }`;

export function getTrust(trust: string): string {
  return (`
    {
      trust(id:"${trust}"){
        notices{
          id
        }
      }
    }
  `);
}