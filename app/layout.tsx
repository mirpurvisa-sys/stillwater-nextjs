import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Stillwater | Funeral & Memorial Care',description:'Thoughtful guidance, personal memorials and practical support for families. Arrange care, honour a life and plan ahead.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
