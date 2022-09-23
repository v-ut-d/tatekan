import fs from 'fs/promises';

export default class json{
    filename: string;
    constructor(filename: string){
        this.filename=filename
    };
    async read(): Promise<Record<string,any>>{
        const dict = await fs.access(this.filename+'.json')
            .then(() => fs.readFile(this.filename+'.json', { encoding: 'utf-8' }))
            .catch(() => '{}')
            .then(JSON.parse);
        return dict;
    };

    async write(dict: Record<string, any>, writing: Record<string, Array<number>>){
        if (!(this.filename in writing)) writing[this.filename]= [0, 0];
        writing[this.filename][0]+=1;
        if (writing[this.filename][1] === 0){
            writing[this.filename][1] = 1;
            while (writing[this.filename][0] > 0){
                await fs.writeFile(this.filename+'.json', JSON.stringify(dict))
                .then(() => {writing[this.filename][0] -= 1})
            }
            writing[this.filename][1] = 0;
        }
        
    }
}


