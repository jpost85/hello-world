/* ===========================================================================
   Liberty's Call — a turn-based Revolutionary War strategy game.
   Vanilla JS, no dependencies. Player = Patriots, AI = British Crown.
   =========================================================================== */
(function () {
  "use strict";

  /* ----------------------------- Configuration ---------------------------- */
  const CONFIG = {
    startGold: 120,
    crownStartGold: 110,
    crownRecruitCap: 6,     // max soldiers the AI musters per turn
    crownReinforceEvery: 3, // British regulars arrive by sea every N turns
    crownReinforceBase: 7,  // troops per wave (grows slowly over the war)
    recruitCost: 14,        // gold per soldier
    recruitBatch: 3,        // soldiers added per Recruit press
    cityDefenseBonus: 1.35, // multiplier to defender strength in cities/capitals
    capitalDefenseBonus: 1.6,
    startMorale: 100,
    maxMorale: 120,
    finalTurn: 32,          // ~1783
    franceTurn: 6,          // earliest France may intervene
    franceMoraleNeeded: 75, // patriot resolve required to draw France in
    seasons: ["Spring", "Summer", "Autumn", "Winter"],
  };

  const SAVE_KEY = "libertys-call-save-v1";

  /* ------------------------------- Map data ------------------------------- */
  // Regions of the colonial seaboard. Geometry (path + label anchor) lives in
  // MAPDATA; `label` (optional) overrides the on-map text, `name` shows in the panel.
  const REGION_DEFS = [
    { id: "quebec",    name: "Quebec",         income: 6,  city: true,  capital: false },
    { id: "nh",        name: "New Hampshire",  income: 4,  city: false, capital: false },
    { id: "mass",      name: "Massachusetts",  income: 7,  city: true,  capital: false },
    { id: "rhode",     name: "Rhode Island",   income: 3,  city: false, capital: false, label: "R.I." },
    { id: "conn",      name: "Connecticut",    income: 4,  city: false, capital: false },
    { id: "ny",        name: "New York",       income: 8,  city: true,  capital: "crown" },
    { id: "nj",        name: "New Jersey",     income: 4,  city: false, capital: false },
    { id: "penn",      name: "Pennsylvania",   income: 8,  city: true,  capital: "patriot" },
    { id: "del",       name: "Delaware",       income: 3,  city: false, capital: false },
    { id: "md",        name: "Maryland",       income: 5,  city: false, capital: false },
    { id: "va",        name: "Virginia",       income: 8,  city: true,  capital: false },
    { id: "nc",        name: "North Carolina", income: 5,  city: false, capital: false },
    { id: "sc",        name: "South Carolina", income: 6,  city: true,  capital: false },
    { id: "ga",        name: "Georgia",        income: 4,  city: false, capital: false },
    // Neutral / disputed frontier — lands either side may seize and use.
    { id: "vermont",   name: "Vermont",        income: 3,  city: false, capital: false },
    { id: "ohio",      name: "Ohio Country",   income: 4,  city: false, capital: false },
    { id: "appalachia",name: "Appalachia",     income: 3,  city: false, capital: false },
    { id: "florida",   name: "East Florida",   income: 4,  city: true,  capital: false },
  ];

  const ADJACENCY = {
    quebec: ["mass", "ny", "nh", "vermont"],
    nh:     ["mass", "quebec", "vermont"],
    mass:   ["quebec", "conn", "rhode", "nh", "vermont"],
    rhode:  ["mass", "conn"],
    conn:   ["mass", "ny", "rhode"],
    ny:     ["quebec", "conn", "nj", "penn", "vermont"],
    nj:     ["ny", "penn", "del"],
    penn:   ["ny", "nj", "md", "del", "ohio", "va"],
    del:    ["nj", "penn", "md"],
    md:     ["penn", "del", "va"],
    va:     ["md", "nc", "penn", "appalachia", "ohio"],
    nc:     ["va", "sc", "appalachia"],
    sc:     ["nc", "ga"],
    ga:     ["sc", "florida", "appalachia"],
    // Neutral frontier adjacency
    vermont:    ["ny", "nh", "mass", "quebec"],
    ohio:       ["penn", "va", "appalachia"],
    appalachia: ["va", "nc", "ga", "ohio"],
    florida:    ["ga"],
  };

  // Starting positions: owner + troops.
  const SETUP = {
    quebec: { owner: "crown",   troops: 10 },
    nh:     { owner: "patriot", troops: 4 },
    mass:   { owner: "patriot", troops: 6 },
    rhode:  { owner: "patriot", troops: 3 },
    conn:   { owner: "patriot", troops: 4 },
    ny:     { owner: "crown",   troops: 16 },
    nj:     { owner: "patriot", troops: 4 },
    penn:   { owner: "patriot", troops: 10 },
    del:    { owner: "patriot", troops: 3 },
    md:     { owner: "patriot", troops: 4 },
    va:     { owner: "patriot", troops: 7 },
    nc:     { owner: "patriot", troops: 4 },
    sc:     { owner: "patriot", troops: 5 },
    ga:     { owner: "crown",   troops: 8 },
    vermont:    { owner: "neutral", troops: 2 },
    ohio:       { owner: "neutral", troops: 3 },
    appalachia: { owner: "neutral", troops: 3 },
    florida:    { owner: "neutral", troops: 5 },
  };

  /* ----------------- Generated geographic map data (see tools-genmap.js) -- */
  const MAPDATA = {"viewBox":"0 0 691 900","terrain":["M0.6 332.5L42.7 332.5L42.7 335.5L42.9 390.3L42.3 454.4L39.6 456.4L42.5 469.0L36.3 469.3L29.6 473.5L20.5 471.5L20.9 480.6L14.8 484.4L12.5 490.1L6.2 492.4L2.9 504.0L-1.2 507.0L-9.2 502.7L-10.5 497.4L-18.3 503.2L-17.7 508.3L-25.7 510.0L-28.1 505.5L-37.0 510.0L-39.9 514.8L-48.9 508.0L-53.6 509.5L-56.7 506.2L-59.6 509.5L-68.6 510.0L-71.9 514.3L-73.1 511.3L-70.9 500.5L-68.2 498.2L-69.2 492.4L-65.1 491.7L-58.7 481.8L-57.5 475.8L-53.0 469.3L-53.6 461.2L-58.1 451.4L-54.2 443.1L-54.0 334.7L-50.5 337.7L-39.6 337.7L-29.0 332.5L0.6 332.5Z","M90.8 333.7L42.7 335.5L42.7 332.5L0.6 332.5L-29.0 332.5L-21.8 326.4L-16.9 316.1L-12.5 309.8L-9.2 301.0L-7.2 288.5L-8.0 274.9L-18.5 248.2L-15.2 238.2L-17.5 226.1L-9.3 213.8L-7.6 203.4L-8.8 197.9L-2.9 195.6L-2.1 188.1L7.0 186.1L14.0 177.8L13.5 194.4L17.2 195.1L21.8 186.8L22.0 172.8L25.0 169.2L34.7 167.0L31.6 157.2L38.0 148.9L46.0 148.4L55.0 153.7L63.7 154.4L68.0 160.9L74.7 161.4L85.8 167.5L89.7 167.2L95.7 177.0L90.8 182.3L95.5 189.1L97.3 196.9L95.1 214.0L87.9 218.3L86.1 227.1L77.6 230.1L72.9 240.7L74.7 244.7L83.2 248.5L89.9 242.7L97.6 230.9L109.9 226.3L116.0 229.9L119.7 236.4L123.4 255.5L124.0 265.1L127.9 276.6L124.2 293.2L118.3 295.7L118.1 289.7L114.2 291.5L109.7 305.3L102.5 310.6L100.4 321.1L91.4 329.9L90.8 333.7Z M17.7 150.1L18.3 155.7L13.6 156.7L15.6 148.9L17.7 150.1Z M-56.3 179.3L-61.8 174.5L-58.5 168.0L-66.8 167.0L-63.5 160.7L-63.1 152.6L-70.5 147.1L-74.6 141.3L-89.8 136.8L-94.5 138.3L-109.7 131.5L-146.4 122.2L-150.3 114.4L-156.9 111.7L-143.0 106.9L-136.8 101.3L-121.2 99.1L-111.1 92.3L-106.4 92.0L-102.5 87.3L-91.4 80.5L-85.7 74.7L-77.4 70.9L-69.4 74.2L-83.4 88.3L-86.7 93.0L-86.5 101.6L-79.7 95.1L-67.4 96.1L-57.9 100.6L-49.3 113.2L-44.6 115.4L-35.7 113.4L-33.5 116.2L-24.5 117.7L-5.5 107.1L4.5 106.1L17.7 106.6L26.7 103.1L33.5 102.8L34.9 115.7L41.9 117.4L48.9 115.4L51.8 118.4L56.5 114.7L66.9 113.4L67.0 129.5L71.7 136.3L78.7 138.1L79.5 133.5L86.3 133.5L90.0 138.3L86.9 141.8L67.4 138.8L58.1 140.8L48.0 135.3L45.0 140.3L46.4 144.6L41.9 143.6L35.3 137.3L23.8 133.5L17.9 133.3L12.3 139.3L2.9 140.8L-7.2 139.6L-11.3 142.1L-12.3 147.1L-23.4 151.4L-22.8 145.4L-27.7 144.1L-29.6 150.4L-37.8 150.6L-41.5 153.4L-47.0 164.2L-57.1 178.0L-56.3 179.3Z M-99.6 47.0L-108.5 52.8L-113.2 53.6L-112.8 48.8L-90.4 38.0L-94.7 45.5L-99.6 47.0Z","M-48.1 642.8L14.2 643.6L20.5 683.0L29.2 741.1L33.3 754.0L37.2 761.3L35.7 765.8L39.8 768.5L33.7 774.3L33.9 780.1L30.8 787.9L34.3 801.7L31.8 813.8L35.7 826.4L18.1 826.6L-56.7 826.6L-57.9 832.7L-49.9 841.5L-51.3 849.0L-48.5 852.8L-53.8 859.6L-58.7 861.1L-67.6 853.6L-68.6 842.2L-71.3 841.0L-74.6 849.5L-75.8 857.8L-85.0 855.6L-87.7 785.4L-79.5 698.1L-74.4 647.8L-78.1 643.1L-48.1 642.8Z","M-87.7 643.1L-78.1 643.1L-74.4 647.8L-79.5 698.1L-87.7 785.4L-85.0 855.6L-88.9 857.6L-97.4 856.6L-100.9 853.6L-109.5 855.6L-121.4 860.8L-125.1 864.1L-129.4 859.3L-130.8 851.8L-136.6 841.7L-133.1 826.6L-200.3 826.6L-197.8 823.4L-200.3 814.3L-196.1 813.8L-195.5 797.0L-192.0 798.0L-189.8 787.7L-181.4 781.1L-177.2 770.6L-177.9 757.0L-183.2 751.2L-182.8 741.9L-180.3 739.9L-183.6 734.6L-180.9 728.3L-182.8 718.8L-179.7 715.0L-185.9 708.9L-180.3 694.9L-173.8 687.6L-176.0 682.5L-168.6 675.0L-168.8 672.0L-162.3 669.5L-162.9 660.4L-159.2 658.4L-156.7 650.6L-151.0 647.1L-153.2 643.1L-87.7 643.1Z","M-164.9 298.0L-99.0 298.8L-63.9 298.8L-65.1 307.6L-59.6 317.9L-54.0 334.7L-54.2 443.1L-58.1 451.4L-53.6 461.2L-53.0 469.3L-57.5 475.8L-58.7 481.8L-65.1 491.7L-69.2 492.4L-68.2 498.2L-70.9 500.5L-73.1 511.3L-71.9 514.3L-76.6 520.8L-73.3 528.9L-87.9 533.2L-89.3 537.9L-85.9 544.0L-90.4 547.7L-103.5 540.7L-107.6 541.2L-113.0 549.2L-111.3 551.8L-116.9 551.3L-124.9 538.2L-122.0 535.2L-124.9 526.4L-124.9 519.3L-136.4 509.5L-140.3 510.5L-144.2 504.5L-154.7 495.2L-154.5 487.9L-148.5 476.1L-149.5 471.8L-146.0 466.3L-151.0 463.0L-158.8 461.0L-162.9 465.2L-165.7 462.5L-168.0 447.4L-179.9 437.6L-190.8 425.8L-195.3 411.7L-195.7 402.4L-192.5 395.8L-192.0 387.5L-182.0 382.5L-181.0 375.5L-176.4 370.9L-175.8 362.9L-181.6 356.4L-179.3 348.3L-165.5 346.0L-154.3 340.3L-153.2 333.2L-148.5 330.2L-147.1 321.4L-148.1 315.6L-156.1 311.1L-157.1 306.3L-164.9 298.0Z","M319.2 459.5L323.7 464.0L319.0 468.8L316.3 462.2L319.2 459.5Z"],"regions":{"nh":{"path":"M531.1 169.7L532.8 199.4L535.2 259.8L540.8 265.1L540.2 269.6L544.5 272.9L540.4 281.4L536.9 280.7L527.4 285.2L523.5 289.5L482.2 287.9L479.1 284.4L479.4 277.6L482.6 275.1L482.2 268.6L484.9 249.2L491.1 240.2L494.3 229.9L497.4 226.1L497.2 214.8L509.1 210.5L514.9 202.7L511.6 195.1L516.5 187.6L516.1 183.1L521.1 171.3L529.3 172.5L531.1 169.7Z","cx":518,"cy":248},"mass":{"path":"M536.9 280.7L540.4 281.4L541.8 289.5L540.2 296.0L534.6 302.0L534.4 309.1L542.2 310.1L546.9 317.4L546.1 323.2L550.0 324.7L550.4 329.9L560.3 334.5L571.8 330.2L569.3 336.5L552.3 342.0L546.1 342.3L542.4 338.0L536.5 339.3L536.4 342.5L529.7 344.5L527.0 336.2L526.0 334.7L522.3 331.5L520.4 320.6L515.1 320.6L505.6 321.1L505.6 320.4L460.9 319.6L445.5 319.1L444.8 317.4L453.3 287.2L482.2 287.9L523.5 289.5L527.4 285.2L536.9 280.7Z M544.5 272.9L540.2 269.6L540.8 265.1L535.2 259.8L532.8 199.4L531.1 169.7L546.5 163.5L544.0 160.2L549.8 153.1L555.8 149.9L554.7 147.1L560.3 142.8L558.6 134.8L562.1 122.7L567.5 118.7L569.7 105.9L597.2 70.7L603.6 72.2L604.0 80.7L608.7 83.7L620.2 78.7L627.4 78.7L632.4 75.4L642.4 82.7L648.2 88.8L648.6 140.3L647.8 152.6L660.1 155.9L658.4 161.2L661.5 166.2L658.9 170.8L664.0 177.8L670.6 176.3L677.1 192.6L669.7 199.9L665.4 197.2L661.9 202.2L656.8 200.9L656.2 205.2L649.6 204.7L639.1 214.5L636.5 207.7L632.8 207.2L634.6 214.5L626.4 218.0L624.4 212.2L620.5 215.3L611.4 215.3L611.2 208.5L605.7 210.0L606.7 214.8L601.6 224.8L602.6 227.6L596.0 233.1L589.4 231.1L585.5 236.9L580.0 237.6L575.5 242.4L570.1 241.4L568.5 236.4L560.5 244.4L562.7 249.5L556.8 251.2L556.4 255.5L549.8 260.8L544.5 272.9Z","cx":509.1,"cy":298.5},"rhode":{"path":"M527.0 336.2L529.7 344.5L522.7 345.5L527.0 336.2Z M515.1 320.6L520.4 320.6L522.3 331.5L526.0 334.7L521.7 334.0L518.0 340.8L516.9 350.3L503.4 352.6L505.6 348.3L505.6 321.1L515.1 320.6Z","cx":518,"cy":342.1},"conn":{"path":"M460.9 319.6L505.6 320.4L505.6 321.1L505.6 348.3L503.4 352.6L500.3 351.8L484.7 355.3L466.2 354.3L458.2 360.6L449.6 362.6L439.5 367.9L437.0 362.6L445.7 357.6L443.2 353.8L445.5 319.1L460.9 319.6Z","cx":462.8,"cy":349},"ny":{"path":"M450.6 183.1L451.0 192.6L449.0 201.2L452.4 209.5L451.4 218.3L447.3 227.6L450.4 240.2L448.5 243.9L454.1 251.5L452.9 283.2L453.3 287.2L444.8 317.4L445.5 319.1L443.2 353.8L445.7 357.6L437.0 362.6L439.5 367.9L454.7 371.7L457.8 368.9L470.9 368.9L477.5 367.4L488.4 360.1L489.2 365.4L494.8 367.7L481.8 374.5L454.3 384.5L442.8 386.5L435.2 386.0L429.5 388.3L426.4 380.7L430.7 367.4L418.8 360.9L402.5 350.8L400.9 347.6L395.4 347.3L389.0 339.5L389.8 332.7L385.5 327.4L382.8 327.7L378.9 321.4L222.2 321.4L222.2 309.8L222.2 309.1L244.0 296.0L247.5 289.7L254.5 285.4L251.8 277.6L248.9 276.1L246.7 263.6L267.6 258.3L286.1 258.5L293.5 259.8L301.5 264.8L306.6 262.8L322.0 263.0L331.3 259.8L341.3 251.5L347.7 251.2L347.9 238.7L351.2 231.4L343.2 226.3L345.0 220.5L359.2 212.8L364.5 206.0L381.6 190.6L397.8 182.8L421.9 184.1L450.6 183.1Z","cx":381,"cy":277.8},"nj":{"path":"M418.8 360.9L430.7 367.4L426.4 380.7L420.6 383.8L417.5 390.8L427.2 394.3L428.0 399.6L423.7 424.3L412.6 442.6L405.4 447.9L399.0 459.5L395.6 451.9L385.3 448.1L372.6 438.1L371.9 431.3L371.7 430.3L373.6 427.8L376.9 422.2L386.5 418.5L387.1 415.0L398.0 407.4L399.7 403.4L389.6 394.1L389.2 388.3L384.7 386.8L384.3 381.5L389.8 373.5L386.9 368.7L395.8 359.1L397.8 354.1L402.5 350.8L418.8 360.9Z","cx":409.5,"cy":408.7},"penn":{"path":"M222.2 309.8L222.2 321.4L378.9 321.4L382.8 327.7L385.5 327.4L389.8 332.7L389.0 339.5L395.4 347.3L400.9 347.6L402.5 350.8L397.8 354.1L395.8 359.1L386.9 368.7L389.8 373.5L384.3 381.5L384.7 386.8L389.2 388.3L389.6 394.1L399.7 403.4L398.0 407.4L387.1 415.0L386.5 418.5L376.9 422.2L369.7 421.0L363.7 426.0L232.3 426.0L195.3 426.0L195.3 384.0L195.3 322.4L195.3 322.4L201.9 319.9L222.2 309.1L222.2 309.8Z","cx":292,"cy":373.1},"del":{"path":"M376.9 422.2L373.6 427.8L369.9 430.8L370.7 438.1L376.0 444.9L377.3 456.2L384.9 468.0L388.4 468.5L390.0 484.4L367.0 483.9L363.7 426.0L369.7 421.0L376.9 422.2Z","cx":375.7,"cy":456.9},"md":{"path":"M356.3 507.2L355.5 507.2L354.5 507.2L356.3 507.2Z M232.3 426.0L363.7 426.0L367.0 483.9L390.0 484.4L383.0 503.7L377.5 504.5L367.8 507.2L360.2 509.3L360.4 501.7L357.4 498.7L361.5 495.4L356.1 487.9L354.3 491.2L346.9 490.4L344.4 482.1L346.7 482.1L346.9 471.3L349.3 467.0L346.1 452.4L350.0 443.9L356.1 442.4L357.0 433.6L352.6 434.6L352.4 439.1L343.0 444.9L340.3 450.2L339.7 463.5L336.2 469.8L337.8 480.3L342.4 487.6L341.8 493.2L344.8 498.7L343.2 502.5L335.0 495.2L323.3 491.7L319.8 484.6L313.2 488.6L310.7 483.1L315.9 476.1L319.0 468.8L323.7 464.0L319.2 459.5L316.3 462.2L311.6 458.0L304.2 455.7L304.2 448.9L300.3 445.1L294.9 444.4L290.8 431.5L284.7 431.5L278.7 427.3L275.4 430.8L269.5 430.5L268.2 435.6L257.7 432.3L250.6 439.1L246.0 437.6L238.9 445.4L231.9 449.7L232.3 426.0Z","cx":313.4,"cy":438.5},"va":{"path":"M377.5 504.5L383.0 503.7L378.3 511.5L373.4 514.3L370.5 524.9L363.1 542.0L357.0 545.5L355.1 539.2L358.2 525.1L367.8 507.2L377.5 504.5Z M355.5 507.2L356.3 507.2L354.5 507.2L355.5 507.2Z M272.5 437.8L291.0 453.2L294.9 444.4L300.3 445.1L304.2 448.9L304.2 455.7L311.6 458.0L316.3 462.2L319.0 468.8L315.9 476.1L311.6 478.1L308.9 484.6L310.5 489.4L320.0 487.9L321.8 495.2L334.2 498.2L337.8 504.0L347.7 510.3L343.2 523.1L347.3 533.2L342.4 537.9L341.8 543.7L346.3 547.2L341.5 552.8L334.1 545.5L332.3 548.0L338.7 553.3L356.3 554.5L360.8 571.6L231.1 572.1L203.3 571.9L178.9 571.1L154.0 569.9L83.0 569.4L102.1 562.8L104.5 557.8L111.3 556.0L111.7 552.0L116.9 549.0L116.9 545.5L130.0 538.7L143.6 526.4L143.1 530.1L147.9 537.9L154.0 541.7L158.5 541.5L165.3 535.4L170.1 540.2L179.3 537.7L195.5 528.9L196.8 531.6L203.1 527.6L203.3 519.3L207.2 512.0L213.8 505.2L216.5 496.9L223.5 488.4L226.3 477.8L232.3 484.1L238.2 486.1L241.9 482.4L249.5 466.0L254.0 470.0L270.5 451.4L272.5 437.8Z M195.3 384.0L195.3 426.0L232.3 426.0L231.9 449.7L238.9 445.4L246.0 437.6L250.6 439.1L257.7 432.3L268.2 435.6L269.5 430.5L275.4 430.8L278.7 427.3L284.7 431.5L290.8 431.5L294.9 444.4L291.0 453.2L272.5 437.8L270.5 451.4L254.0 470.0L249.5 466.0L241.9 482.4L238.2 486.1L232.3 484.1L226.3 477.8L223.5 488.4L216.5 496.9L213.8 505.2L207.2 512.0L203.3 519.3L203.1 527.6L196.8 531.6L195.5 528.9L179.3 537.7L170.1 540.2L165.3 535.4L158.5 541.5L154.0 541.7L147.9 537.9L143.1 530.1L143.6 526.4L139.0 525.6L132.1 520.3L130.4 515.0L124.7 508.3L120.5 499.5L121.4 485.6L130.8 484.6L132.1 478.6L136.4 476.1L134.7 469.0L141.3 458.0L146.6 465.0L150.3 460.7L149.3 455.4L153.8 446.6L157.9 446.9L162.0 440.4L165.9 443.4L170.3 441.4L184.2 426.5L187.5 409.7L192.4 398.6L192.6 391.6L190.0 386.5L195.3 384.0Z","cx":231.5,"cy":491.3},"nc":{"path":"M178.9 571.1L203.3 571.9L231.1 572.1L360.8 571.6L364.8 590.0L354.9 588.2L353.5 590.5L341.5 593.3L339.7 595.8L331.7 596.5L332.1 599.8L341.8 597.5L343.2 599.5L353.9 597.3L357.4 601.6L363.9 599.8L366.2 610.9L364.1 616.1L359.8 616.6L350.8 628.0L338.9 628.5L337.0 636.3L342.0 644.1L346.1 645.6L338.5 658.4L332.1 656.9L320.8 658.1L313.0 660.9L300.7 669.7L291.0 681.3L285.9 695.9L278.5 692.6L265.6 695.6L225.3 651.9L185.3 651.1L185.9 645.8L180.5 638.0L176.8 640.8L176.6 636.0L132.7 633.7L123.0 635.5L115.4 639.8L103.1 642.8L85.0 643.6L60.0 643.3L61.0 632.5L68.0 631.5L70.8 623.9L79.5 617.2L89.3 616.9L98.0 609.9L107.2 607.3L115.0 597.0L119.9 594.0L120.8 598.5L134.9 589.7L141.3 591.5L145.8 582.9L152.4 580.7L154.0 569.9L178.9 571.1Z","cx":237.3,"cy":618.2},"sc":{"path":"M115.4 639.8L123.0 635.5L132.7 633.7L176.6 636.0L176.8 640.8L180.5 638.0L185.9 645.8L185.3 651.1L225.3 651.9L265.6 695.6L259.4 697.9L251.6 705.4L244.0 717.2L242.6 726.8L236.6 734.3L228.6 734.3L226.9 739.9L218.5 745.9L213.8 752.5L206.4 755.2L198.4 762.3L197.6 765.5L190.2 769.3L182.2 779.1L174.0 775.1L173.9 767.3L168.2 755.0L163.3 751.7L162.9 741.9L160.6 734.3L151.0 727.3L144.8 718.8L145.2 713.5L135.7 705.7L131.0 697.1L122.8 691.3L117.1 681.8L116.0 676.5L110.5 666.4L106.8 667.2L94.9 657.4L95.5 652.6L103.1 642.8L115.4 639.8Z","cx":181.9,"cy":693.2},"ga":{"path":"M103.1 642.8L95.5 652.6L94.9 657.4L106.8 667.2L110.5 666.4L116.0 676.5L117.1 681.8L122.8 691.3L131.0 697.1L135.7 705.7L145.2 713.5L144.8 718.8L151.0 727.3L160.6 734.3L162.9 741.9L163.3 751.7L168.2 755.0L173.9 767.3L174.0 775.1L182.2 779.1L173.5 794.7L171.9 802.8L168.2 809.8L167.8 817.1L163.9 820.4L162.4 840.0L152.6 838.2L144.4 834.4L141.1 838.0L142.5 846.5L140.9 855.8L136.6 856.1L134.9 846.3L89.3 842.7L40.5 839.7L35.7 826.4L31.8 813.8L34.3 801.7L30.8 787.9L33.9 780.1L33.7 774.3L39.8 768.5L35.7 765.8L37.2 761.3L33.3 754.0L29.2 741.1L20.5 683.0L14.2 643.6L60.0 643.3L85.0 643.6L103.1 642.8Z","cx":91.1,"cy":750.9},"vermont":{"path":"M516.1 183.1L516.5 187.6L511.6 195.1L514.9 202.7L509.1 210.5L497.2 214.8L497.4 226.1L494.3 229.9L491.1 240.2L484.9 249.2L482.2 268.6L482.6 275.1L479.4 277.6L479.1 284.4L482.2 287.9L453.3 287.2L452.9 283.2L454.1 251.5L448.5 243.9L450.4 240.2L447.3 227.6L451.4 218.3L452.4 209.5L449.0 201.2L451.0 192.6L450.6 183.1L487.4 183.6L516.1 183.1Z","cx":466.4,"cy":213.5},"ohio":{"path":"M195.3 322.4L195.3 384.0L190.0 386.5L192.6 391.6L192.4 398.6L187.5 409.7L184.2 426.5L170.3 441.4L165.9 443.4L162.0 440.4L157.9 446.9L153.8 446.6L149.3 455.4L150.3 460.7L146.6 465.0L141.3 458.0L134.7 469.0L136.4 476.1L132.1 478.6L130.8 484.6L121.4 485.6L116.6 479.3L112.5 478.1L110.9 470.3L105.8 471.8L101.9 476.3L88.5 472.8L82.8 476.1L74.8 469.8L63.7 468.0L63.2 464.0L55.9 454.4L42.3 454.4L42.9 390.3L42.7 335.5L90.8 333.7L104.7 340.0L109.3 343.8L112.8 340.3L120.6 347.6L125.5 349.8L142.1 343.8L151.8 345.0L162.4 336.5L177.7 328.2L195.3 322.4L195.3 322.4Z","cx":117.7,"cy":399.5},"appalachia":{"path":"M74.8 469.8L82.8 476.1L88.5 472.8L101.9 476.3L105.8 471.8L110.9 470.3L112.5 478.1L116.6 479.3L121.4 485.6L120.5 499.5L124.7 508.3L130.4 515.0L132.1 520.3L139.0 525.6L143.6 526.4L130.0 538.7L116.9 545.5L116.9 549.0L111.7 552.0L111.3 556.0L104.5 557.8L102.1 562.8L83.0 569.4L82.4 570.1L52.0 569.6L25.5 568.1L18.5 568.6L-20.8 566.9L-65.7 567.9L-73.5 565.8L-72.9 574.1L-117.1 573.6L-121.4 574.1L-119.5 568.4L-114.2 570.4L-111.3 551.8L-113.0 549.2L-107.6 541.2L-103.5 540.7L-90.4 547.7L-85.9 544.0L-89.3 537.9L-87.9 533.2L-73.3 528.9L-76.6 520.8L-71.9 514.3L-68.6 510.0L-59.6 509.5L-56.7 506.2L-53.6 509.5L-48.9 508.0L-39.9 514.8L-37.0 510.0L-28.1 505.5L-25.7 510.0L-17.7 508.3L-18.3 503.2L-10.5 497.4L-9.2 502.7L-1.2 507.0L2.9 504.0L6.2 492.4L12.5 490.1L14.8 484.4L20.9 480.6L20.5 471.5L29.6 473.5L36.3 469.3L42.5 469.0L39.6 456.4L42.3 454.4L55.9 454.4L63.2 464.0L63.7 468.0L74.8 469.8Z M-72.9 574.1L-73.5 565.8L-65.7 567.9L-20.8 566.9L18.5 568.6L25.5 568.1L52.0 569.6L82.4 570.1L83.0 569.4L154.0 569.9L152.4 580.7L145.8 582.9L141.3 591.5L134.9 589.7L120.8 598.5L119.9 594.0L115.0 597.0L107.2 607.3L98.0 609.9L89.3 616.9L79.5 617.2L70.8 623.9L68.0 631.5L61.0 632.5L60.0 643.3L14.2 643.6L-48.1 642.8L-78.1 643.1L-87.7 643.1L-153.2 643.1L-149.7 641.8L-146.2 633.7L-146.7 622.7L-140.1 615.1L-139.0 608.1L-133.7 605.6L-132.5 597.0L-125.5 585.5L-125.7 574.1L-123.8 574.1L-121.4 574.1L-117.1 573.6L-72.9 574.1Z","cx":131.9,"cy":583.2},"florida":{"path":"M18.1 826.6L35.7 826.4L40.5 839.7L89.3 842.7L134.9 846.3L136.6 856.1L140.9 855.8L142.5 846.5L141.1 838.0L144.4 834.4L152.6 838.2L162.4 840.0L164.5 859.8L169.0 882.2L179.3 911.6L195.1 943.1L192.8 945.3L193.5 959.9L200.2 976.3L210.5 1009.2L212.6 1019.5L212.4 1030.1L208.5 1068.1L205.2 1068.8L201.7 1080.7L202.9 1084.4L196.1 1093.0L193.3 1091.0L186.7 1094.5L175.4 1096.5L172.1 1091.7L173.7 1084.7L165.7 1064.3L159.4 1060.5L154.0 1063.3L149.7 1052.0L148.5 1042.7L141.1 1032.4L139.4 1025.6L140.5 1015.8L136.4 1014.0L137.4 1019.8L133.7 1021.3L122.4 996.4L117.9 990.1L128.6 971.8L121.6 972.8L116.9 978.5L112.3 969.5L118.5 944.3L119.7 923.5L115.4 918.4L114.0 911.6L107.2 910.1L99.2 899.1L92.8 894.5L92.4 887.8L87.9 885.2L84.2 877.7L70.6 867.6L58.7 869.9L59.3 876.9L55.4 875.7L40.5 884.2L24.8 886.2L25.1 881.2L21.4 875.2L2.9 861.6L-10.3 855.8L-22.2 854.3L-32.2 855.3L-53.8 859.6L-48.5 852.8L-51.3 849.0L-49.9 841.5L-57.9 832.7L-56.7 826.6L18.1 826.6Z","cx":142.6,"cy":851.8},"quebec":{"path":"M231.5 64.3L338.3 27.6L498.4 18.4L576.7 43.6L598.1 71.2L558.9 124.0L537.6 156.1L518.0 181.4L452.2 183.7L402.3 183.7L324.1 220.4L249.3 234.2L228.0 174.5L231.5 64.3Z","cx":445,"cy":96.4}},"annotations":[{"text":"District of Maine","x":594.5,"y":169.9}]};

  /* ------------------------------- Game state ----------------------------- */
  let S = null; // active game state
  let selected = null;      // selected region id
  let pendingAction = null; // info for the troop modal

  function newState() {
    const regions = {};
    for (const def of REGION_DEFS) {
      const setup = SETUP[def.id];
      regions[def.id] = {
        id: def.id,
        owner: setup.owner,
        troops: setup.troops,
        acted: false,
      };
    }
    return {
      turn: 1,
      regions,
      gold: CONFIG.startGold,
      crownGold: CONFIG.crownStartGold,
      morale: { patriot: CONFIG.startMorale, crown: CONFIG.startMorale },
      franceJoined: false,
      over: false,
      log: [],
    };
  }

  /* ------------------------------- Helpers -------------------------------- */
  const def = (id) => REGION_DEFS.find((r) => r.id === id);
  const $ = (sel) => document.querySelector(sel);

  function rng(min, max) { return min + Math.random() * (max - min); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function regionIncome(id) {
    return def(id).income;
  }
  function defenseBonus(id) {
    const d = def(id);
    if (d.capital) return CONFIG.capitalDefenseBonus;
    if (d.city) return CONFIG.cityDefenseBonus;
    return 1;
  }
  function ownedRegions(owner) {
    return Object.values(S.regions).filter((r) => r.owner === owner);
  }
  function incomeFor(owner) {
    let total = ownedRegions(owner).reduce((sum, r) => sum + regionIncome(r.id), 0);
    if (owner === "patriot" && S.franceJoined) total += 10; // French subsidies
    return total;
  }
  function capitalOwner(side) {
    const capId = side === "patriot" ? "penn" : "ny";
    return S.regions[capId].owner;
  }

  function dateLabel(turn) {
    const idx = turn - 1;
    const season = CONFIG.seasons[idx % 4];
    const year = 1775 + Math.floor(idx / 4);
    return `${season} ${year}`;
  }

  /* --------------------------------- Log ---------------------------------- */
  function log(msg, cls) {
    S.log.unshift({ msg, cls: cls || "" });
    if (S.log.length > 60) S.log.pop();
    renderLog();
  }

  function renderLog() {
    const ul = $("#log");
    ul.innerHTML = "";
    for (const entry of S.log) {
      const li = document.createElement("li");
      li.textContent = entry.msg;
      if (entry.cls) li.className = entry.cls;
      ul.appendChild(li);
    }
  }

  /* ------------------------------- Banner --------------------------------- */
  let bannerTimer = null;
  function showBanner(text, ms) {
    const b = $("#banner");
    $("#banner-text").textContent = text;
    b.classList.remove("hidden");
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => b.classList.add("hidden"), ms || 2600);
  }

  /* ------------------------------ Rendering ------------------------------- */
  const SVGNS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs) {
    const el = document.createElementNS(SVGNS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  function renderMap() {
    const map = $("#map");
    map.innerHTML = "";
    map.setAttribute("viewBox", MAPDATA.viewBox);
    const [, , vbW, vbH] = MAPDATA.viewBox.split(" ").map(Number);

    map.appendChild(buildDefs());

    // Ocean backdrop.
    map.appendChild(svgEl("rect", { x: 0, y: 0, width: vbW, height: vbH, fill: "url(#ocean)" }));

    // Whole landmass shadow (drawn under everything via a group offset).
    const landGroup = svgEl("g", { filter: "url(#landshadow)" });
    for (const d of MAPDATA.terrain) {
      landGroup.appendChild(svgEl("path", { d, class: "terrain" }));
    }
    for (const d of REGION_DEFS) {
      landGroup.appendChild(svgEl("path", { d: MAPDATA.regions[d.id].path, class: "land-base" }));
    }
    map.appendChild(landGroup);

    const movable = selected ? legalMoves(selected) : { move: [], attack: [] };

    // Playable region territories, tinted by owner.
    for (const d of REGION_DEFS) {
      const r = S.regions[d.id];
      const geo = MAPDATA.regions[d.id];
      const path = svgEl("path", {
        d: geo.path, class: "region-shape region-" + r.owner, "data-id": d.id,
      });
      if (selected === d.id) path.classList.add("selected");
      if (movable.move.includes(d.id)) path.classList.add("movable");
      if (movable.attack.includes(d.id)) path.classList.add("attackable");
      path.addEventListener("click", () => onRegionClick(d.id));
      map.appendChild(path);

      // Dim a region whose army has already marched.
      if (r.acted && r.owner === "patriot") {
        const dim = svgEl("path", { d: geo.path, class: "acted-mark" });
        map.appendChild(dim);
      }
    }

    // Decorative cartography.
    map.appendChild(oceanLabel(vbW, vbH));
    map.appendChild(compassRose(vbW - 64, 70));
    for (const a of (MAPDATA.annotations || [])) {
      const t = svgEl("text", { x: a.x, y: a.y, class: "sub-label", "pointer-events": "none" });
      t.textContent = a.text;
      map.appendChild(t);
    }

    // Overlays (labels, capitals, troop badges) drawn last so they sit on top.
    for (const d of REGION_DEFS) {
      const r = S.regions[d.id];
      const geo = MAPDATA.regions[d.id];
      const g = svgEl("g", { class: "overlay", "pointer-events": "none" });

      // Region name
      const label = svgEl("text", { x: geo.cx, y: geo.cy - 13, class: "region-label" });
      label.textContent = d.label || d.name;
      g.appendChild(label);

      // Capital star above the name
      if (d.capital) {
        g.appendChild(svgEl("path", {
          d: starPath(geo.cx, geo.cy - 28, 6.5, 2.8, 5), class: "capital-star",
        }));
      }

      // Troop badge at the centroid
      g.appendChild(svgEl("circle", {
        cx: geo.cx, cy: geo.cy + 6, r: 13,
        class: "troop-badge troop-" + r.owner,
      }));
      const tt = svgEl("text", { x: geo.cx, y: geo.cy + 10.5, class: "troop-text" });
      tt.textContent = r.troops;
      g.appendChild(tt);

      map.appendChild(g);
    }
  }

  // Reusable gradient / filter definitions.
  function buildDefs() {
    const defs = svgEl("defs", {});
    const ocean = svgEl("linearGradient", { id: "ocean", x1: "0", y1: "0", x2: "1", y2: "1" });
    ocean.appendChild(svgEl("stop", { offset: "0%", "stop-color": "#a9c6cf" }));
    ocean.appendChild(svgEl("stop", { offset: "100%", "stop-color": "#7ba6b3" }));
    defs.appendChild(ocean);

    const filter = svgEl("filter", { id: "landshadow", x: "-10%", y: "-10%", width: "120%", height: "120%" });
    filter.appendChild(svgEl("feDropShadow", {
      dx: "0", dy: "3", stdDeviation: "4", "flood-color": "#1a2b30", "flood-opacity": "0.45",
    }));
    defs.appendChild(filter);
    return defs;
  }

  function oceanLabel(w, h) {
    const t = svgEl("text", { x: w - 150, y: h - 120, class: "ocean-label" });
    t.textContent = "ATLANTIC OCEAN";
    return t;
  }

  function compassRose(cx, cy) {
    const g = svgEl("g", { class: "compass", "pointer-events": "none" });
    g.appendChild(svgEl("circle", { cx, cy, r: 26, class: "compass-ring" }));
    // 4-point star
    const pts = [
      [cx, cy - 24], [cx + 6, cy - 6], [cx + 24, cy], [cx + 6, cy + 6],
      [cx, cy + 24], [cx - 6, cy + 6], [cx - 24, cy], [cx - 6, cy - 6],
    ];
    let d = "";
    pts.forEach((p, i) => { d += (i === 0 ? "M" : "L") + p[0] + " " + p[1]; });
    g.appendChild(svgEl("path", { d: d + "Z", class: "compass-star" }));
    const n = svgEl("text", { x: cx, y: cy - 30, class: "compass-n" });
    n.textContent = "N";
    g.appendChild(n);
    return g;
  }

  function starPath(cx, cy, outer, inner, points) {
    let path = "";
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = (Math.PI / points) * i - Math.PI / 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      path += (i === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1);
    }
    return path + "Z";
  }

  function renderTopbar() {
    $("#stat-date").textContent = dateLabel(S.turn);
    $("#stat-gold").textContent = S.gold;
    $("#stat-income").textContent = "+" + incomeFor("patriot");
    $("#bar-patriot").style.width = (S.morale.patriot / CONFIG.maxMorale * 100) + "%";
    $("#bar-crown").style.width = (S.morale.crown / CONFIG.maxMorale * 100) + "%";
  }

  function renderSidebar() {
    const nameEl = $("#ri-name");
    const ownerEl = $("#ri-owner");
    const actionsEl = $("#ri-actions");
    const hintEl = $("#ri-hint");
    actionsEl.innerHTML = "";

    if (!selected) {
      nameEl.textContent = "Select a region";
      ownerEl.textContent = "";
      ownerEl.className = "ri-owner";
      $("#ri-troops").textContent = "—";
      $("#ri-income").textContent = "—";
      $("#ri-def").textContent = "—";
      hintEl.textContent = "Click a region to inspect it. Click one of your armies to give orders.";
      return;
    }

    const d = def(selected);
    const r = S.regions[selected];
    nameEl.textContent = d.name + (d.capital ? "  ★" : "");
    const ownerName = r.owner === "patriot" ? "Patriot" : r.owner === "crown" ? "British Crown" : "Neutral";
    ownerEl.textContent = ownerName + (d.capital === r.owner ? " — Capital" : "") + (d.city ? " · City" : "");
    ownerEl.className = "ri-owner " + r.owner;

    $("#ri-troops").textContent = r.troops;
    $("#ri-income").textContent = regionIncome(selected);
    const bonus = defenseBonus(selected);
    $("#ri-def").textContent = bonus > 1 ? "+" + Math.round((bonus - 1) * 100) + "%" : "—";

    const moves = legalMoves(selected);

    if (r.owner === "patriot") {
      // Recruit
      const recruitBtn = document.createElement("button");
      const cost = CONFIG.recruitCost * CONFIG.recruitBatch;
      recruitBtn.className = "btn";
      recruitBtn.textContent = `Recruit ${CONFIG.recruitBatch} troops (${cost}g)`;
      recruitBtn.disabled = S.gold < cost;
      recruitBtn.addEventListener("click", () => recruit(selected));
      actionsEl.appendChild(recruitBtn);

      if (r.acted) {
        hintEl.textContent = "This army has already marched this turn.";
      } else if (r.troops <= 0) {
        hintEl.textContent = "No troops stationed here. Recruit or reinforce.";
      } else if (moves.move.length === 0 && moves.attack.length === 0) {
        hintEl.textContent = "No adjacent regions to move into.";
      } else {
        hintEl.textContent = "Click a highlighted region: green to reinforce, red to attack.";
      }
    } else if (r.owner === "neutral") {
      hintEl.textContent = "Unclaimed frontier, held by local militia. March an adjacent army here to bring it into the fold.";
    } else {
      hintEl.textContent = "Enemy-held. Attack from an adjacent army (highlighted).";
    }
  }

  function renderAll() {
    renderMap();
    renderTopbar();
    renderSidebar();
  }

  /* ----------------------------- Move legality ---------------------------- */
  function legalMoves(id) {
    const r = S.regions[id];
    const out = { move: [], attack: [] };
    if (!r || r.owner !== "patriot" || r.acted || r.troops <= 0) return out;
    for (const other of ADJACENCY[id]) {
      if (S.regions[other].owner === "patriot") out.move.push(other);
      else out.attack.push(other);
    }
    return out;
  }

  /* ------------------------------ Interaction ----------------------------- */
  function onRegionClick(id) {
    if (S.over) return;

    // If we have a selected patriot army and clicked a legal target, act.
    if (selected && selected !== id) {
      const moves = legalMoves(selected);
      if (moves.move.includes(id)) {
        openTroopDialog("move", selected, id);
        return;
      }
      if (moves.attack.includes(id)) {
        openTroopDialog("attack", selected, id);
        return;
      }
    }

    // Otherwise just select/inspect.
    selected = id;
    renderAll();
  }

  /* ------------------------------- Recruit -------------------------------- */
  function recruit(id) {
    const cost = CONFIG.recruitCost * CONFIG.recruitBatch;
    if (S.gold < cost) return;
    S.gold -= cost;
    S.regions[id].troops += CONFIG.recruitBatch;
    log(`Mustered ${CONFIG.recruitBatch} troops in ${def(id).name}.`, "");
    save();
    renderAll();
  }

  /* --------------------------- Troop move dialog -------------------------- */
  function openTroopDialog(kind, fromId, toId) {
    const from = S.regions[fromId];
    const max = from.troops;
    if (max <= 0) return;
    pendingAction = { kind, fromId, toId };

    const overlay = $("#modal-overlay");
    const slider = $("#troop-slider");
    slider.min = 1;
    slider.max = max;
    slider.value = max;
    $("#troop-count").textContent = max;

    if (kind === "move") {
      $("#modal-title").textContent = "March to " + def(toId).name;
      $("#modal-text").textContent =
        `Move how many of ${def(fromId).name}'s ${max} troops to reinforce ${def(toId).name}?`;
    } else {
      const enemy = S.regions[toId].troops;
      $("#modal-title").textContent = "Attack " + def(toId).name;
      $("#modal-text").textContent =
        `${def(toId).name} is defended by ${enemy} troops` +
        (defenseBonus(toId) > 1 ? " behind fortifications" : "") +
        `. Commit how many of your ${max}?`;
    }
    overlay.classList.remove("hidden");
  }

  function closeTroopDialog() {
    $("#modal-overlay").classList.add("hidden");
    pendingAction = null;
  }

  function confirmTroopDialog() {
    if (!pendingAction) return;
    const count = parseInt($("#troop-slider").value, 10);
    const { kind, fromId, toId } = pendingAction;
    closeTroopDialog();
    if (kind === "move") doMove(fromId, toId, count);
    else doAttack(fromId, toId, count);
  }

  /* --------------------------------- Move --------------------------------- */
  function doMove(fromId, toId, count) {
    const from = S.regions[fromId];
    const to = S.regions[toId];
    count = clamp(count, 1, from.troops);
    from.troops -= count;
    to.troops += count;
    from.acted = true;
    log(`${count} troops marched from ${def(fromId).name} to ${def(toId).name}.`, "");
    selected = toId;
    save();
    renderAll();
  }

  /* -------------------------------- Battle -------------------------------- */
  // Returns { win, attLoss, defLoss }
  function resolveBattle(attackers, defenders, defBonus) {
    const attPower = attackers * rng(0.75, 1.25);
    const defPower = defenders * rng(0.75, 1.25) * defBonus;
    const win = attPower >= defPower;
    let attLoss, defLoss;
    if (win) {
      // Attacker prevails; casualties scale with how close it was.
      const ratio = clamp(defPower / Math.max(attPower, 1), 0.1, 1);
      attLoss = Math.round(attackers * (0.2 + 0.35 * ratio));
      defLoss = defenders; // defenders routed / region taken
    } else {
      // Assault broken, but survivors retreat — not annihilated.
      const ratio = clamp(attPower / Math.max(defPower, 1), 0.1, 1);
      attLoss = Math.round(attackers * (0.4 + 0.35 * ratio));
      defLoss = Math.round(defenders * (0.15 + 0.3 * ratio));
    }
    attLoss = clamp(attLoss, 1, attackers);
    defLoss = clamp(defLoss, 0, defenders);
    return { win, attLoss, defLoss };
  }

  function doAttack(fromId, toId, count) {
    const from = S.regions[fromId];
    const to = S.regions[toId];
    count = clamp(count, 1, from.troops);
    const defenders = to.troops;
    const defBonus = defenseBonus(toId);
    from.acted = true;

    const result = resolveBattle(count, defenders, defBonus);
    from.troops -= count; // committed troops leave home region

    const attName = def(fromId).name, defName = def(toId).name;

    if (result.win) {
      const survivors = count - result.attLoss;
      const wasCapital = def(toId).capital === to.owner;
      const loser = to.owner;
      const wasNeutral = loser === "neutral";
      to.owner = "patriot";
      to.troops = survivors;
      to.acted = true; // freshly captured army holds position
      if (wasNeutral) {
        log(`${defName} won over to the cause (lost ${result.attLoss}, militia ${defenders}).`, "l-good");
        showBanner("⚑  " + defName + " joins the Patriots!");
        adjustMorale("patriot", 3); // a frontier gain, not a blow to the enemy
      } else {
        log(`Victory at ${defName}! ${defName} falls to the Patriots (lost ${result.attLoss}, enemy ${defenders}).`, "l-good");
        showBanner("⚔  " + defName + " captured!");
        adjustMorale("patriot", def(toId).city ? 8 : 5);
        adjustMorale(loser, def(toId).city ? -8 : -5);
      }
      if (wasCapital) {
        adjustMorale(loser, -30);
        log(`The enemy capital at ${defName} has fallen! A grievous blow to the Crown.`, "l-event");
      }
    } else {
      // Assault repelled; survivors retreat home.
      const survivors = count - result.attLoss;
      from.troops += survivors;
      to.troops -= result.defLoss;
      log(`Assault on ${defName} repelled. We lost ${result.attLoss}; the enemy lost ${result.defLoss}.`, "l-bad");
      showBanner("Assault on " + defName + " repelled");
      adjustMorale("patriot", -3);
    }

    selected = result.win ? toId : fromId;
    save();
    renderAll();
    checkWin();
  }

  /* ------------------------------- Morale --------------------------------- */
  function adjustMorale(side, delta) {
    if (side !== "patriot" && side !== "crown") return; // neutral has no resolve
    S.morale[side] = clamp(S.morale[side] + delta, 0, CONFIG.maxMorale);
  }

  /* ------------------------------ End turn -------------------------------- */
  function endTurn() {
    if (S.over) return;
    selected = null;

    // Collect income.
    const income = incomeFor("patriot");
    S.gold += income;
    log(`Treasury collects ${income} gold from the colonies.`, "");

    // AI takes its turn.
    crownTurn();
    if (S.over) return;

    // Advance turn & reset action flags.
    S.turn += 1;
    for (const r of Object.values(S.regions)) r.acted = false;

    // Crown income (internal economy for AI recruiting).
    S.crownGold += incomeFor("crown");

    maybeFranceEvent();

    if (S.turn > CONFIG.finalTurn) {
      endByAttrition();
      return;
    }

    log(`— ${dateLabel(S.turn)} —`, "l-event");
    save();
    renderAll();
    checkWin();
  }

  /* ------------------------------- Crown AI ------------------------------- */
  function crownTurn() {
    const crownRegions = ownedRegions("crown");
    if (crownRegions.length === 0) return;

    // 0) Periodic British regulars arrive by sea at a held port.
    if (S.turn % CONFIG.crownReinforceEvery === 0) {
      const ports = crownRegions.filter((r) => def(r.id).city);
      const landing = S.regions.ny.owner === "crown" ? S.regions.ny
        : (ports[0] || crownRegions[0]);
      const wave = CONFIG.crownReinforceBase + Math.floor(S.turn / 8);
      landing.troops += wave;
      S.crownGold += 20;
      log(`A British fleet lands ${wave} regulars at ${def(landing.id).name}.`, "l-bad");
      showBanner("⚓  British regulars land at " + def(landing.id).name);
    }

    // 1) Recruit reinforcements at the strongest front-line city.

    let recruits = Math.floor(S.crownGold / CONFIG.recruitCost);
    recruits = Math.min(recruits, CONFIG.crownRecruitCap); // pace the AI
    if (recruits > 0) {
      // Prefer a city adjacent to a patriot region (the front).
      const front = crownRegions.filter((r) =>
        ADJACENCY[r.id].some((n) => S.regions[n].owner === "patriot"));
      const pool = front.length ? front : crownRegions;
      const target = pool.reduce((best, r) =>
        (def(r.id).city ? 1 : 0) - (best && def(best.id).city ? 1 : 0) >= 0 ? r : best, pool[0]);
      target.troops += recruits;
      S.crownGold -= recruits * CONFIG.recruitCost;
      log(`British reinforcements land at ${def(target.id).name} (+${recruits}).`, "l-bad");
    }

    // 2) Each Crown army acts once: attack a beatable neighbour, else mass toward Philadelphia.
    const acted = new Set();
    // Re-evaluate ownership dynamically as battles change the map.
    const armies = ownedRegions("crown").map((r) => r.id);
    for (const id of armies) {
      const r = S.regions[id];
      if (!r || r.owner !== "crown" || acted.has(id) || r.troops <= 1) continue;

      // Prefer striking the rebels; pick the patriot neighbour we can best beat.
      const patriotTargets = ADJACENCY[id].filter((n) => S.regions[n].owner === "patriot");
      let bestAtk = null, bestScore = -Infinity;
      for (const t of patriotTargets) {
        const score = r.troops - S.regions[t].troops * defenseBonus(t);
        if (score > bestScore) { bestScore = score; bestAtk = t; }
      }

      // Otherwise, grab adjacent neutral frontier if clearly winnable.
      let neutralGrab = null;
      if (!(bestAtk && bestScore > -2)) {
        for (const t of ADJACENCY[id].filter((n) => S.regions[n].owner === "neutral")) {
          const score = r.troops - S.regions[t].troops * defenseBonus(t);
          if (score > 2) { neutralGrab = t; break; }
        }
      }

      if (bestAtk && bestScore > -2) {
        crownAttack(id, bestAtk);
        acted.add(id);
        acted.add(bestAtk); // captured/contested region shouldn't act again
      } else if (neutralGrab) {
        crownAttack(id, neutralGrab);
        acted.add(id);
        acted.add(neutralGrab);
      } else {
        // Reinforce toward the front: shift troops to a crown neighbour closer to penn.
        const reinforceTo = ADJACENCY[id]
          .filter((n) => S.regions[n].owner === "crown")
          .sort((a, b) => dist(a, "penn") - dist(b, "penn"))[0];
        if (reinforceTo && dist(reinforceTo, "penn") < dist(id, "penn") && r.troops > 2) {
          const move = Math.floor(r.troops / 2);
          r.troops -= move;
          S.regions[reinforceTo].troops += move;
          acted.add(id);
        }
      }
    }

    renderAll();
    checkWin();
  }

  function crownAttack(fromId, toId) {
    const from = S.regions[fromId];
    const to = S.regions[toId];
    const committed = from.troops; // AI commits its full stack
    const result = resolveBattle(committed, to.troops, defenseBonus(toId));
    const defenders = to.troops;
    from.troops = 0;

    if (result.win) {
      const survivors = committed - result.attLoss;
      const wasCapital = def(toId).capital === to.owner;
      const wasNeutral = to.owner === "neutral";
      to.owner = "crown";
      to.troops = survivors;
      if (wasNeutral) {
        log(`The British seize the frontier of ${def(toId).name}.`, "l-bad");
        showBanner("✗  " + def(toId).name + " seized by the Crown");
        adjustMorale("crown", 3);
      } else {
        log(`The British storm ${def(toId).name}! It is lost (we had ${defenders}).`, "l-bad");
        showBanner("✗  " + def(toId).name + " has fallen to the Crown");
        adjustMorale("crown", def(toId).city ? 8 : 5);
        adjustMorale("patriot", def(toId).city ? -8 : -5);
      }
      if (wasCapital) {
        adjustMorale("patriot", -30);
        log(`Our capital at ${def(toId).name} is taken! The cause teeters.`, "l-event");
      }
    } else {
      from.troops = committed - result.attLoss; // survivors hold their ground
      to.troops -= result.defLoss;
      log(`We repulsed a British attack on ${def(toId).name}! Enemy lost ${result.attLoss}.`, "l-good");
      adjustMorale("patriot", 4);
      adjustMorale("crown", -4);
    }
  }

  // BFS distance between regions (in hops).
  const distCache = {};
  function dist(a, b) {
    const key = a + ">" + b;
    if (distCache[key] != null) return distCache[key];
    const seen = new Set([a]);
    let frontier = [a], d = 0;
    while (frontier.length) {
      if (frontier.includes(b)) { distCache[key] = d; return d; }
      const next = [];
      for (const n of frontier) for (const m of ADJACENCY[n]) if (!seen.has(m)) { seen.add(m); next.push(m); }
      frontier = next; d++;
    }
    distCache[key] = 99; return 99;
  }

  /* --------------------------- France intervention ------------------------ */
  function maybeFranceEvent() {
    if (S.franceJoined) return;
    if (S.turn < CONFIG.franceTurn) return;
    if (S.morale.patriot < CONFIG.franceMoraleNeeded) return;

    S.franceJoined = true;
    S.gold += 80;
    adjustMorale("patriot", 12);
    // French regulars land in a Patriot coastal city if available.
    const landing = ["va", "sc", "penn", "mass"].find((id) => S.regions[id].owner === "patriot");
    if (landing) S.regions[landing].troops += 10;
    log("FRANCE ENTERS THE WAR! French gold, regulars, and a fleet bolster the cause.", "l-event");
    showBanner("⚜  France joins the Revolution!", 3800);
  }

  /* ----------------------------- Win checking ----------------------------- */
  function checkWin() {
    if (S.over) return;
    const patriotCount = ownedRegions("patriot").length;
    const crownCount = ownedRegions("crown").length;

    if (crownCount === 0) {
      return gameOver(true, "Every British garrison has been driven into the sea. The United States are free and independent!");
    }
    if (S.morale.crown <= 0) {
      return gameOver(true, "The Crown's will is broken. Weary of an unwinnable war, Britain recognizes American independence!");
    }
    if (patriotCount === 0) {
      return gameOver(false, "The last Continental army is scattered. The rebellion is crushed, and the colonies remain British.");
    }
    if (S.morale.patriot <= 0) {
      return gameOver(false, "Patriot resolve has collapsed. The Congress disbands and the dream of independence dies.");
    }
  }

  function endByAttrition() {
    S.turn = CONFIG.finalTurn; // freeze display
    const holdsCapital = capitalOwner("patriot") === "patriot";
    if (holdsCapital && S.morale.patriot >= S.morale.crown) {
      gameOver(true, "1783: Weary of a war it cannot win, Britain recognizes American independence. You endured!");
    } else if (holdsCapital) {
      gameOver(true, "1783: The war grinds to a close. Bloodied but unbroken, the colonies secure their independence.");
    } else {
      gameOver(false, "1783: With its capital lost, the rebellion could not hold. The crown prevails.");
    }
  }

  function gameOver(patriotWon, text) {
    S.over = true;
    S.winner = patriotWon ? "patriot" : "crown";
    save();
    renderAll();
    $("#go-title").textContent = patriotWon ? "Independence!" : "The Cause is Lost";
    $("#go-title").style.color = patriotWon ? "var(--patriot)" : "var(--crown)";
    $("#go-text").textContent = text;
    $("#gameover").classList.remove("hidden");
  }

  /* ------------------------------ Persistence ----------------------------- */
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
  }
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function hasSave() { return !!load(); }

  /* ------------------------------- Screens -------------------------------- */
  function show(screenId) {
    for (const s of document.querySelectorAll(".screen")) s.classList.add("hidden");
    $("#" + screenId).classList.remove("hidden");
  }

  function startGame(state) {
    S = state || newState();
    selected = null;
    $("#gameover").classList.add("hidden");
    show("game-screen");
    renderLog();
    renderAll();
    if (!state) log(`The war for independence begins — ${dateLabel(1)}.`, "l-event");
  }

  /* ------------------------------- Wiring --------------------------------- */
  function init() {
    $("#btn-new-game").addEventListener("click", () => startGame(null));
    $("#btn-continue").addEventListener("click", () => {
      const s = load();
      if (s) startGame(s); else showBanner("No saved campaign found");
    });
    $("#btn-how-to").addEventListener("click", () => show("howto-screen"));
    $("#btn-howto-back").addEventListener("click", () => show("title-screen"));
    $("#btn-end-turn").addEventListener("click", endTurn);
    $("#btn-menu").addEventListener("click", () => { save(); show("title-screen"); refreshContinue(); });

    $("#modal-cancel").addEventListener("click", closeTroopDialog);
    $("#modal-confirm").addEventListener("click", confirmTroopDialog);
    $("#troop-slider").addEventListener("input", (e) => {
      $("#troop-count").textContent = e.target.value;
    });
    $("#go-restart").addEventListener("click", () => startGame(null));

    refreshContinue();
  }

  function refreshContinue() {
    $("#btn-continue").disabled = !hasSave();
  }

  document.addEventListener("DOMContentLoaded", init);

  // Test hook: expose core logic for headless simulation (no effect in browser).
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      newState, resolveBattle, dist, incomeFor, checkWin, crownTurn, endTurn,
      doAttack, doMove, legalMoves, maybeFranceEvent, recruit, defenseBonus,
      CONFIG, ADJACENCY,
      getState: () => S,
      setState: (x) => { S = x; },
      setSelected: (x) => { selected = x; },
    };
  }
})();
