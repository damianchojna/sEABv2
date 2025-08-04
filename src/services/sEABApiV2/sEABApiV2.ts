import * as SocketPromise from "socket-promise"
import sEABApiOptionsInterface from "./sEABApiOptionsInterface"
import SeabApiDto from "./SeabApiDto"
import Logger from "../Logger/Logger"
import DateService from "../DateService"
import ProfileEnum from "../../domain/Profile/ProfileEnum"
import ProfileInterface from "../../domain/Profile/model/ProfileInterface"
import ProfileDto from "../../domain/Profile/ProfileDto"
import {Moment} from "moment"

export default class sEABApiV2 {
    socket: SocketPromise
    options: sEABApiOptionsInterface
    B: number
    connected: boolean
    registerMode: boolean

    constructor(options: sEABApiOptionsInterface) {
        this.options = options
        this.connected = false
        this.registerMode = false
    }

    async connect(): Promise<void> {
        this.socket = new SocketPromise()
        const {ip, port, timeout, serialNumber} = this.options
        const milisec: number = await this.socket.conn(ip, port, timeout)
        Logger.debug("Czas otwarcia portu TCP:", milisec)

        /*
            ETAP 1

            Inicjalizacja transmisji następuje po wysłaniu

            Request:  /Attt.nnnnnnn[CR][LF]
            Response: /gttt.nnnnnnn[CR][LF]

            Gdzie:
                ttt.nnnnnnn – oznacza numer fabryczny licznika
         */
        await this.socket.write(`/${serialNumber}\r\n`)
        const sequenceWithMeterAddress = await this.socket.recv("\r\n", timeout)
        Logger.debug("Numer fabryczny licznika:", sequenceWithMeterAddress.toString())

        /*
            ETAP 2

            Nawiązanie transmisji z licznikiem następuje po wysłaniu do licznika polecenia
            Request:  /?![CR][LF]
            Response: /POZBnazwa-ttt.nnnnnnn-VPvv.vv*[CR][LF]

            Gdzie:
                POZ skrótowe oznaczenie producenta – POZYTON
                B identyfikator prędkości, zgodny z wymaganiami normy PN-EN 62056-21
                nazwa oznaczenie produktu (sEA)
                ttt.nnnnnnn numer fabryczny licznika
                vv.vv oznaczenie wersji

                B Prędkość transmisji (bitów/s);
                    0 300
                    1 600
                    2 1200
                    3 2400
                    4 4800
                    5 9600
                    6 19200
                    7 38400 (niedostępna w trybie rejestrowym)

            Przykładowa odpowiedź:
                /POZ5sEA-523.1016498-VP02.09*[CR][LF]

                POZ            - skrótowe oznaczenie producenta – POZYTON
                5              - identyfikator prędkości, zgodny z wymaganiami normy PN-EN 62056-21
                sEA            - nazwa oznaczenie produktu (sEA)
                523.1016498    - ttt.nnnnnnn numer fabryczny licznika
                VP02.09        - vv.vv oznaczenie wersji
         */
        await this.socket.write("/?!\r\n")
        const softVersion = await this.socket.recv("\r\n", timeout)
        Logger.debug("Info licznika:", softVersion.toString())

        this.B = softVersion.toString().substring(4, 5)
        Logger.debug("Prędkość transmisji:", SeabApiDto.transmissionMarkToSpeedValue(this.B))
        this.connected = true

        /*
            ETAP 3

            Oczekiwanie na sekwencję ustalenia trybu pracy max 8 sekund.

            Request: Wybór trybu odczytu standardowego zestawu danych, jeden z listy:
                [ACK]0B4[CR][LF] - standardowy zestaw danych obejmuje rejestry z następujących grup: dane podstawowe, bieżący okres obrachunkowy, wartości chwilowe i wartości konfiguracyjne
                [ACK]0B3[CR][LF] - to co pierwszy + dodatkowo z pełnym archiwum okresów obrachunkowych (12 okresów obrachunkowych)
                [ACK]0B0[CR][LF] - to co pierwszy i drugi + dodatkowo z najmłodszym blokiem cykli profilu (ostatnie 3360 cykli)
                [ACK]0B5[CR][LF] - to co drugi ale z pełnym profilem mocy (wszystkie bloki profilowe tj. 134400 cykli)
                [ACK]0B1[CR][LF] - wybór trybu rejestrowego

            Gdzie:
                B - oznacza wybrana predkosc transmisji Po odebraniu sekwencji ustalenia trybu pracy licznik zmienia prędkość na wynikającą z identyfikatora prędkości B

            Response: Wysyłka każdego zestawu danych rozpoczyna się znakiem [STX] i kończy sekwencją znaków:
                ![CR][LF][ETX][BCC]
         */
    }

    async disconnect() {
        try {
            if (this.registerMode) await this.stopRegisterMode()
        } catch (e) {
            Logger.error("sEABApiV2-disconnect-stopRegisterMode", e)
        }

        try {
            if (this.connected) {
                this.connected = false
                await this.socket.destroy()
            }
        } catch (e) {
            Logger.error("sEABApiV2-disconnect-socket.destroy", e)
        }
    }

    async getStandardDataSet(addChecksum) {
        if (this.registerMode) {
            await this.disconnect()
            await this.connect()
        }

        const command = "\x06" + `0${this.B}4` + "\r\n"
        await this.socket.write(addChecksum ? this.addBccCheckSum(command) : command)
        const data = await this.socket.recv("!\r\n\x03", this.options.timeout)
        return data.toString()
    }

    async getTime(addCheckSum: boolean = false): Promise<Moment> {
        //@TODO globalna lista wymagan co do polączen
        if (!this.registerMode) await this.startRegisterMode()

        const command = "\x01" + "R1" + "\x02" + "T()" + "\x03"

        await this.socket.write(addCheckSum ? this.addBccCheckSum(command) : command)
        const dataT = await this.socket.recv("\r\n\x03", this.options.timeout)

        const re = /^\x0228\.\((.*)\)\x0d\x0a29\.\((.*)\)/
        const matches = dataT.toString().match(re)



        return DateService.parseDate(matches[2] + " " + matches[1], "DD-MM-YY HH:mm:ss")
    }

    /*
     * Bieżąca moc bierna na poszczeglnych fazach
     */
    async getReactivePower(): Promise<{
        L1: number
        L2: number
        L3: number
        SUM: number
    }> {
        //@TODO globalna lista wymagan co do polączen
        if (!this.registerMode) await this.startRegisterMode()

        await this.socket.write("\x01" + "R1" + "\x02" + "Q()" + "\x03")
        const dataQ = await this.socket.recv("\r\n\x03", this.options.timeout)

        const re = /^\x02109\(([- ]{1})([0-9]{3}\.[0-9]{1});([- ]{1})([0-9]{3}\.[0-9]{1});([- ]{1})([0-9]{3}\.[0-9]{1});([- ]{1})([0-9]{3}\.[0-9]{1})/
        const matches = dataQ.toString().match(re)
        return {
            L1: Number(matches[1] === "-" ? -matches[2] : +matches[2]),
            L2: Number(matches[3] === "-" ? -matches[4] : +matches[2]),
            L3: Number(matches[5] === "-" ? -matches[6] : +matches[2]),
            SUM: Number(matches[7] === "-" ? -matches[8] : +matches[8])
        }
    }

    /*
      Moc Czynna
     */
    async getActivePower(addCheckSum: boolean = false): Promise<{
        L1: number
        L2: number
        L3: number
        SUM: number
    }> {
        const command = "\x01" + "R1" + "\x02" + "P()" + "\x03"
        await this.socket.write(addCheckSum ? this.addBccCheckSum(command) : command)
        const dataP = await this.socket.recv("\r\n\x03", this.options.timeout)

        const response = dataP.toString().replace(/^\x02107\(/, "").replace(/\)\r?\n?.*$/, "")
        const values = response.split(";").map(v => parseFloat(v.trim()))

        if (values.length === 5) {
            // Nowy firmware – L1, L2, L3, sumImport, sumExport
            const [L1, L2, L3, sumImport, sumExport] = values

            return {
                L1,
                L2,
                L3,
                SUM: +(sumImport - sumExport).toFixed(2)
            }
        } else if (values.length === 4) {
            // Stary firmware – L1, L2, L3, SUM
            const [L1, L2, L3, SUM] = values
            return { L1, L2, L3, SUM }
        } else {
            throw new Error("Nieoczekiwany format odpowiedzi z licznika")
        }
    }

    /*
      Napięcie fazowe
     */
    async getPhaseVoltage(addCheckSum: boolean = false): Promise<{
        L1: number
        L2: number
        L3: number
        S1: boolean
        S2: boolean
        S3: boolean
        W : 0 | 1 | 'x'
    }> {
        const command = "\x01" + "R1" + "\x02" + "U()" + "\x03"
        await this.socket.write(addCheckSum ? this.addBccCheckSum(command) : command)
        const dataU = await this.socket.recv("\r\n\x03", this.options.timeout)

        /*
            97.5.6(uuu.uu;uuu.uu;uuu.uu;s;s;s;w)[CR][LF]

            uuu.uu wartość napięcia fazowego w V (kolejno L1, L2, L3);
            s sygnalizacja przekroczenia progu obecności fazy (kolejno L1, L2, L3):
            1 – napięcie fazowe wyższe od zadanego progu,
            0 – napięcie fazowe niższe od zadanego progu; w sygnalizacja kolejności wirowania faz:
            1 – kolejność faz prawidłowa,
            0 – kolejność faz nieprawidłowa,
            x – nie można ustalić kolejności faz.
         */
        const re = /^\x0297\.5\.6\((\d{1,3}\.\d{2});(\d{1,3}\.\d{2});(\d{1,3}\.\d{2});([01]);([01]);([01]);([01x])\)/;
        const match = dataU.toString().match(re);

        const [_, L1, L2, L3, S1, S2, S3, W] = match;

        return {
            L1: +L1, //napięcie L3
            L2: +L2, //napięcie L3
            L3: +L3, //napięcie L3
            S1: !!S1, // sygnalizacja obecności fazy L1
            S2: !!S2, //sygnalizacja obecności fazy L2
            S3: !!S3, //kolejność wirowania faz
            W //kolejność wirowania faz
        }
    }

    /*
      Liczydła energii

       Request:    [SOH]R1[STX]Eezx()[ETX]         - urządzenie odczytowe wysyla sekwencję ustalenia trybu pracy
         Gdzie:
            e - energia: P – czynna, Q – bierna
            z - kierunek przepływu energii: P – dodatni (pobór), M – ujemny (oddawanie);
            x numer strefy:
                0 – liczydło sumaryczne,
                1 – strefa 1,
                2 – strefa 2,
                3 – strefa 3,
                4 – strefa 4;
            y rodzaj energii i kierunek:
                0 – P+ (czynna, kierunek pobór),
                1 – P− (czynna, kierunek oddawanie),
                2 – Q+ (bierna, kierunek pobór),
                3 – Q− (bierna, kierunek oddawanie);

       Response:
         y.8.x(nnnnnn.nn)[CR][LF] - bezpośredni
         y.8.x(nnnnnn.nnn)[CR][LF] - półpośredni
         y.8.x(nnnnnn.nnnn)[CR][LF] - pośredni
         Gdzie:
            nn...n - wartość energii w kWh lub kvarh.
            x numer strefy:
                0 – liczydło sumaryczne,
                1 – strefa 1,
                2 – strefa 2,
                3 – strefa 3,
                4 – strefa 4;
            y rodzaj energii i kierunek:
                0 – P+ (czynna, kierunek pobór),
                1 – P− (czynna, kierunek oddawanie),
                2 – Q+ (bierna, kierunek pobór),
                3 – Q− (bierna, kierunek oddawanie);
     */
    /**
     *
     * @param energyType - P – czynna, Q – bierna;
     * @param direction  - P – dodatni (pobór), M – ujemny (oddawanie)
     * @param numberZone - numer strefy od 0..4
     */
    async getEnergyCounter(direction: "P" | "M" = "P", energyType: "P" | "Q" = "P", numberZone: number = 0, addChecksum?: boolean): Promise<number> {
        if (!this.registerMode) await this.startRegisterMode()

        const command = "\x01" + "R1" + "\x02" + `E${energyType}${direction}${numberZone}()` + "\x03"
        await this.socket.write(addChecksum ? this.addBccCheckSum(command) : command)
        const energyCounterResponse = await this.socket.recv("\r\n\x03", this.options.timeout)

        const re = /^\x02([0-3])\.8\.[0-4]\((.*)\)/
        const matches = energyCounterResponse.toString().match(re)

        return +matches[2]
    }

    /*
       Wybór trybu rejestrowego:

       Request:  [ACK]0B1[CR][LF]                  - urządzenie odczytowe wysyła sekwencję ustalenia trybu pracy
         Response: [SOH]P0[STX](0000)[ETX][BCC]    - licznik odpowiada sekwencja żądania autoryzacyjnego
       Request:  [SOH]P1[STX]()[ETX][BCC]          - urządzenie odczytowe wysyła sekwencje
         Response: [ACK]                           - licznik odpowiada znakiem [ACK] gotowy jest na przyjęcie rozkazów trybu rejestrowego
       Request:  [SOH]R1[STX]kod_rozkazu[ETX]      - rozkaz
         Response: [STX]dane[ETX][BCC]             - licznik zwraca odpowiedz z danymi

       Gdzie:
           B - oznacza wybrana predkosc transmisji Po odebraniu sekwencji ustalenia trybu pracy licznik zmienia prędkość na wynikającą z identyfikatora prędkości B

       Przyklad:

       req: 06 30 35 31 0d 0a                                  [ACK]051[CR][LF]
       res: 01 50 30 02 28 30 30 30  30 29 03 60               [SOH]P0[STX](0000)[ETX][` jako BCC]
       req: 01 50 31 02 28 29 03 61                            [SOH]P1[STX]()[ETX][a jako BCC]
       res: 06                                                 [ACK]
       req: 01 52 31 02 54 28 29 03                            [SOH]R1[STX]T()[ETX]         - Data i czas
       res:
            02 32 38 2e 28 31 30 3a  35 31 3a 32 31 29 0d 0a   [STX]28.(10:51:21)[CR][LF]
            32 39 2e 28 31 31 2d 31  31 2d 31 39 29 0d 0a 03   29.(11-11-19)[CR][LF][EXT]
            0c                                                 [FF jako BCC]
       req: 01 52 31 02 50 28 29 03                            [SOH]R1[STX]P()[EXT]         - Bieżąca moc czynna
       res:
            02 31 30 37 28 2d 30 30  30 2e 32 3b 20 30 30 30   [STX]107(-000.2; 000
            2e 32 3b 2d 30 30 30 2e  32 3b 2d 30 30 30 2e 32   .2;-000.2;-000.2
            29 0d 0a 03 05                                     )[CR][LF][EXT][ENQ jako BCC]
    */
    async startRegisterMode(): Promise<void> {
        if (!this.socket) await this.connect()
        Logger.debug("Register mode starting ")
        await this.socket.write("\x06" + `0${this.B}1` + "\r\n")
        await this.socket.recv("\x03", this.options.timeout) //@TODO control sum
        await this.socket.write(this.addBccCheckSum("\x01" + "P1" + "\x02" + "()" + "\x03"))
        await this.socket.recv("\x06", this.options.timeout) //@TODO control sum
        Logger.debug("Register mode success")
        this.registerMode = true
    }

    /*
        Zakończenie połączenia trybu rejestrowego

        Request:  [SOH]B0[ETX][BCC]     - zakończenie połączenia trybu rejestrowego następuje po odebraniu przez licznik sekwencji:
          Response: [ACK]               - Licznik wysyła znak potwierdzenia [ACK] i zakańcza (zrywa) połączenie. Zakończenie połączenia następuje również automatycznie, jeżeli przez czas 8 sekund licznik nie odbierze żadnego znaku.

     */
    async stopRegisterMode(): Promise<void> {
        if (!this.connected) return
        if (!this.registerMode) return
        this.registerMode = false
        Logger.debug("Register mode stopping ")
        await this.socket.write(this.addBccCheckSum("\x01" + `B0` + "\x03"))
        await this.socket.recv("\x06", this.options.timeout) //@TODO control sum
        Logger.debug("Register mode stopped")
    }

    /*
     *  Odczyt profilu
     *
     *  Request: QI(yxxxx;n) lub QI(yxxxx;nn) lub QI(yxxxx;n;abcdefgh) lub QI(yxxxx;nn;abcdefgh)
     *
     *      Gdzie:
     *          xxxx     - indeks cyklu od którego począwszy chcemy odczytać profil; zakres: 0÷3359 (liczba dziesiętna) 0 – najstarszy cykl w bloku, 3359 – najmłodszy cykl w bloku
     *          n, nn    - liczba komórek profilu do odczytania 0÷F lub 0÷FF (liczba szesnastkowa, 0 będzie traktowane jako 1)
     *          y        - numer (zapis szesnastkowy) bloku profilowego od którego rozpoczynamy odczyt – wartość z zakresu 0÷F, gdzie 0 – najmłodszy blok profilu, a F – najstarszy blok profilu
     *          abcdefgh - bity konfigurujące odczyt profilu interpretacja identyczna jak w punkcie 3.6.2.6 , w przypadku braku parametrów profil wysyłany jest w porządku ustalonym dla zestawu danych zawierającym 3360 ostatnich cykli. - włączamy lub wyłączamy wysyłanie wybranych danych
     *              a – moc czynna, kierunek pobór (P+)
     *              b – moc czynna, kierunek oddawanie (P–)
     *              c – moc bierna, kierunek pobór (Q+)
     *              d – moc bierna, kierunek oddawanie (Q–)
     *              e – energia czynna, kierunek pobór (EP+)
     *              f – energia czynna, kierunek oddawanie (EP–)
     *              g – energia bierna, kierunek pobór (EQ+)
     *              h – energia bierna, kierunek oddawanie (EQ–)
     *
     *  Response:
     *      232.0(abcdefgh)
     *      3.4.0.1(YYNNNN;PPPP;pppp;QQQQ;qqqq;...............................
     *      ............................PPPPPPPP;pppppppp;QQQQQQQQ;qqqqqqqq;SSSS)
     *      (YYNNNN;PPPP;pppp;QQQQ;qqqq;PPPPPPPP;pppppppp;QQQQQQQQ;qqqqqqqq;SSSS)
     *      :
     *      (YYNNNN;PPPP;pppp;QQQQ;qqqq;PPPPPPPP;pppppppp;QQQQQQQQ;qqqqqqqq;SSSS)
     *
     *      Gdzie:
     *          abcdefgh - bity informujące o porządku wysyłanych danych w cyklu profilowym
     *          YY rok – zapis dziesiętny (ostatnie dwie cyfry)
     *          NNNN numer kwadransa w roku (zapis szesnastkowy; wartość 0001 oznacza pierwszy kwadrans w roku tj. przedział czasu od 0:00:00 do 0:15:00 dnia 1 stycznia)
     *          PPPP wartość przyrostu energii P+ (zapis szesnastkowy)
     *          pppp wartość przyrostu energii P− (zapis szesnastkowy)
     *          QQQQ wartość przyrostu energii Q+ (zapis szesnastkowy
     *          qqqq wartość przyrostu energii Q− (zapis szesnastkowy)
     *          PPPPPPPP wartość sumarycznego liczydła energii EP+ (zapis szesnastkowy);
     *          pppppppp wartość sumarycznego liczydła energii EP− (zapis szesnastkowy);
     *          QQQQQQQQ wartość sumarycznego liczydła energii EQ+ (zapis szesnastkowy);
     *          qqqqqqqq wartość sumarycznego liczydła energii EQ− (zapis szesnastkowy);
     *          SSSS status cyklu (zapis szesnastkowy), kodowany zgodnie z poniższą tabelą:
     */

    /**
     * fromCycle: 0÷3359, 0 – najstarszy cykl w bloku, 3359 – najmłodszy cykl w bloku
     * numberOfCycles: 0÷255, 0 będzie uznawane jako 1
     */
    async getProfiles(fromCycle = ProfileEnum.MAX_CYCLES, numberOfCyclesToDownload = 0): Promise<ProfileInterface[]> {
        const preparedFromCycle = fromCycle.toString().padStart(4, "0")
        const preparedNumberOfCycles = numberOfCyclesToDownload
            .toString(16)
            .toUpperCase()
            .padStart(2, "0")

        await this.socket.write("\x01" + "R1" + "\x02" + `QI(0${preparedFromCycle};${preparedNumberOfCycles};11111111)` + "\x03")
        const dataProfiles = await this.socket.recv("\r\n\x03", this.options.timeout)

        const rows = dataProfiles.toString().split("\r\n")

        let profiles = []
        rows.forEach((row, key) => {
            let matches = row.match(
                /\(([0-9]{2})([0-9A-F]{4});([0-9A-F]{4});([0-9A-F]{4});([0-9A-F]{4});([0-9A-F]{4});([0-9A-F]{8});([0-9A-F]{8});([0-9A-F]{8});([0-9A-F]{8});([0-9A-F]{4})\)/
            )
            const profile = ProfileDto.apiResponseToProfileModel(matches)
            if (profile) profiles.push(profile)
        })

        return profiles
    }

    /*
        Obliczanie sumy kontrolnej. Suma kontrolna liczona jest według wzoru:

        BCC = BCC xor znak

        Gdzie:
            znak kod ASCII przesyłanego znaku
            xor oznacza operację: bitowa suma „exclusive-or”

        Początkowa wartość BCC wynosi 0
        Jeżeli w sekwencji danych występuje znak [SOH], to suma kontrolna liczona jest od następującego po nim znaku;
        w przeciwnym wypadku od pierwszego znaku po [STX]. Ostatnim znakiem wliczanym do sumy jest [ETX].

     */
    addBccCheckSum(command: string): string {
        let commandForCheckSumCalculation = command

        if (1 === commandForCheckSumCalculation.charCodeAt(0) || 2 === commandForCheckSumCalculation.charCodeAt(0)) {
            // [SOH] or [STX]
            commandForCheckSumCalculation = commandForCheckSumCalculation.substring(1, commandForCheckSumCalculation.length)
        }

        const buffer = Buffer.from(commandForCheckSumCalculation)

        let bcc = 0
        buffer.forEach(char => {
            bcc = bcc ^ char
        })

        return command + String.fromCharCode(bcc)
    }
}

/*
    Znaki ASCII:
    SOH    x01 - start of heading
    STX    x02 - start of text
    ETX    x03 - end of text
    ACK    x06 - acknowledge
    LF     x0a - NL -line feed, new line
    CR     x0d - carriage return
    FF     x0c - NP - form feed, new page
    SPACE  x20
    ;      x3b
    .      x2e
    -      x2d
    `      x60
    a      x61
 */
