export const Lang = "0xc3A192b4A637fcD20c87e91eEB561121C28d4028";
export const Igor = "0x55d46039e187b37a0201068dE189ecB63eaE87d2";
export const Igor2 = "0x85e5e089782a3cAd89D1672DFBd7A9300d635Aa6";
export const Aleksandr = "0x125854A4Ce5875ca46d1504ECf08897976022563";
export const Andrii = "0xb16398c0698149Ae6EC342614830bC0511b83CAf";
export const Rory = "0x40B7d71E70fA6311cB0b300c1Ba6926A2A9000b8";
export const Kevin = "0x55feDD7843efc88A9ddd066B2ec2C8618C38fB62";
export const Seth = "0x6fA040aD7e94f905a29536Ba786D433638FeD19b";
export const Valerii = "0x5700F8e0ae3d80964f7718EA625E3a2CB4D2096d";
export const Oleksii = "0xa5E32D3fB342D9Ed3135fD5cb59a102AC8ED7B85";
export const OleksiiD = "0x690aBe750E22D95b95B7Fcff70a4B35C10eD0842";
export const Olena = "0xe620e1F969Bc3a24Ac96D527220AD6B6e2d12843";
export const Alina = "0x787afc1E7a61af49D7B94F8E774aC566D1B60e99";
export const Alex = "0xe8592B3a9ee54472A0115262871eF43B5F3e8E53";
export const Sophie = "0xBc2e61822443b18070E387F045CcFAD33E6958d0";
export const Matthieu = "0x37d6bF7e8875137EefA8286e6AEA2cc4bFAF1247";
export const Michael = "0xB72aDaffEb3419487C49690Dc68e963F7d7D81AC";

// testing
// export const SharedDev = "0xD693a3cc5686e74Ca2e72e8120A2F2013B8eE66E";  // old one
export const Dev1111 = "0x1111472FCa4260505EcE4AcD07717CADa41c1111";
export const Dev028b = "0xc9E2CB16dEC44be85b8994D1EcDD4cA7a690c28b";
export const AndriiTest = "0xb017DcCC473499C83f1b553bE564f3CeAf002254";


export const Roadmap2023Addresses = [Valerii, Oleksii, Olena, Igor, Andrii, Alina, Alex, Seth, Sophie, Matthieu, Michael];
export const Roadmap2023MultisigSettings = [Roadmap2023Addresses, Roadmap2023Addresses.map(() => true), 50] as const;  // all are initiators

export const EcosystemAddresses = [Aleksandr, Andrii, Igor2];
export const EcosystemMultisigSettings = [EcosystemAddresses, EcosystemAddresses.map(() => true), 51] as const;  // all are initiators


export function getAddressName(address: string) {
  const names = {
    Lang, Igor, Andrii, Rory, Kevin, Seth, Valerii, Oleksii, OleksiiD, Olena, Alina, Alex, Sophie, Matthieu, Michael,
    Dev1111, DimaTest: Dev028b, AndriiTest
  };
  for (const [name, addr] of Object.entries(names))
    if (addr == address) return name;
}
